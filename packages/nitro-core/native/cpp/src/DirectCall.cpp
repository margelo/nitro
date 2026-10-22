//
//  DirectCall.cpp
//  NitroModules
//

#include <NitroModules/DirectCall.hpp>

#include <cstdlib>
#include <cstring>

#ifdef __ANDROID__
#include <NitroModules/detail/RuntimeData.hpp>
#include <fbjni/fbjni.h>
#endif

extern "C" void nitro_direct_set_string(void* target, const uint8_t* utf8, size_t length) {
  // Allocation failures cannot cross back into Swift, and there is nothing useful to recover.
  try {
    static_cast<margelo::nitro::direct::StringResult*>(target)->set(utf8, length);
  } catch (...) {
    std::abort();
  }
}

extern "C" void nitro_direct_set_error(void* target, const char* message) {
  try {
    *static_cast<std::string*>(target) = message[0] != '\0' ? message : "unknown error";
  } catch (...) {
    std::abort();
  }
}

namespace margelo::nitro::direct {

void throwError(jsi::Runtime& runtime, const char* name, const std::string& message) {
  throw jsi::JSError(runtime, std::string(name) + ": " + message);
}

void StringData::appendSlow(bool ascii, const void* data, size_t count) {
  if (ascii && _isASCII) {
    if (!_onHeap) {
      _ascii.assign(_inline, _length);
      _onHeap = true;
    }
    _ascii.append(static_cast<const char*>(data), count);
    _length += count;
    return;
  }
  if (_isASCII) {
    // Switch to UTF-16 and widen what was copied so far.
    const char* copied = _onHeap ? _ascii.data() : _inline;
    _utf16.assign(copied, copied + _length);
    _isASCII = false;
  }
  if (ascii) {
    const char* characters = static_cast<const char*>(data);
    _utf16.append(characters, characters + count);
  } else {
    _utf16.append(static_cast<const char16_t*>(data), count);
  }
}

#ifdef __ANDROID__
namespace {

  constexpr jsi::UUID RUNTIME_DATA_UUID{0x5bd1c4e2, 0x7a3f, 0x4c1e, 0x9d2b, 0x31f6a8e0c47d};

  jclass directCallClass(JNIEnv* env) {
    static const jclass clazz = [env]() {
      auto local = facebook::jni::findClassLocal("com/margelo/nitro/core/DirectCall");
      return static_cast<jclass>(env->NewGlobalRef(local.get()));
    }();
    return clazz;
  }

  /**
   * Uses a `ByteBuffer.allocateDirect()` buffer as the scratch memory if its backing `byte[]` shares the buffer's
   * memory. ART backs direct buffers with non-movable arrays, so strings then need no `Set/GetByteArrayRegion`.
   * A write in each direction checks the sharing, and any failure leaves the context on the copying path.
   */
  bool useSharedScratch(JNIEnv* env, JavaContext& context) {
    jclass clazz = directCallClass(env);
    static const jmethodID createScratch = env->GetStaticMethodID(clazz, "createScratch", "(I)Ljava/nio/ByteBuffer;");
    jobject buffer = env->CallStaticObjectMethod(clazz, createScratch, static_cast<jint>(kScratchSize));
    if (env->ExceptionCheck() || buffer == nullptr) {
      env->ExceptionClear();
      return false;
    }
    jclass bufferClass = env->GetObjectClass(buffer);
    jmethodID hasArray = env->GetMethodID(bufferClass, "hasArray", "()Z");
    jmethodID array = env->GetMethodID(bufferClass, "array", "()[B");
    jmethodID arrayOffset = env->GetMethodID(bufferClass, "arrayOffset", "()I");
    env->DeleteLocalRef(bufferClass);
    auto* data = static_cast<uint8_t*>(env->GetDirectBufferAddress(buffer));
    jlong capacity = env->GetDirectBufferCapacity(buffer);
    if (data == nullptr || capacity < static_cast<jlong>(kScratchSize) || !env->CallBooleanMethod(buffer, hasArray) ||
        env->ExceptionCheck()) {
      env->ExceptionClear();
      env->DeleteLocalRef(buffer);
      return false;
    }
    auto bytes = static_cast<jbyteArray>(env->CallObjectMethod(buffer, array));
    jint base = env->CallIntMethod(buffer, arrayOffset);
    if (env->ExceptionCheck() || bytes == nullptr || base < 0 || env->GetArrayLength(bytes) - base < static_cast<jint>(kScratchSize)) {
      env->ExceptionClear();
      if (bytes != nullptr) {
        env->DeleteLocalRef(bytes);
      }
      env->DeleteLocalRef(buffer);
      return false;
    }
    // Check the sharing in both directions over the whole scratch area.
    jbyte expected[kScratchSize];
    jbyte actual[kScratchSize];
    for (size_t i = 0; i < kScratchSize; i++) {
      expected[i] = static_cast<jbyte>(0xA5 ^ i);
      data[i] = static_cast<uint8_t>(expected[i]);
    }
    env->GetByteArrayRegion(bytes, base, static_cast<jsize>(kScratchSize), actual);
    bool shared = memcmp(expected, actual, kScratchSize) == 0;
    for (size_t i = 0; i < kScratchSize; i++) {
      expected[i] = static_cast<jbyte>(0x5A ^ i);
    }
    env->SetByteArrayRegion(bytes, base, static_cast<jsize>(kScratchSize), expected);
    shared = shared && memcmp(expected, data, kScratchSize) == 0;
    if (shared) {
      context.scratchBuffer = env->NewGlobalRef(buffer);
      context.scratchBytes = static_cast<jbyteArray>(env->NewGlobalRef(bytes));
      context.scratchData = data;
      context.scratchBase = base;
      context.scratchShared = true;
    }
    env->DeleteLocalRef(bytes);
    env->DeleteLocalRef(buffer);
    return shared;
  }

  /** Wraps `JavaContext::scratch` in a direct `ByteBuffer`, with a separate `byte[]` that strings are copied through. */
  void useCopyingScratch(JNIEnv* env, JavaContext& context) {
    jobject buffer = env->NewDirectByteBuffer(context.scratch, sizeof(context.scratch));
    // Use native byte order, so Kotlin writes values the way C++ reads them.
    jclass bufferClass = env->GetObjectClass(buffer);
    jclass orderClass = env->FindClass("java/nio/ByteOrder");
    jmethodID nativeOrder = env->GetStaticMethodID(orderClass, "nativeOrder", "()Ljava/nio/ByteOrder;");
    jobject order = env->CallStaticObjectMethod(orderClass, nativeOrder);
    jmethodID setOrder = env->GetMethodID(bufferClass, "order", "(Ljava/nio/ByteOrder;)Ljava/nio/ByteBuffer;");
    env->DeleteLocalRef(env->CallObjectMethod(buffer, setOrder, order));
    jbyteArray bytes = env->NewByteArray(sizeof(context.scratch));
    context.scratchBytes = static_cast<jbyteArray>(env->NewGlobalRef(bytes));
    context.scratchBuffer = env->NewGlobalRef(buffer);
    context.scratchData = context.scratch;
    context.scratchBase = 0;
    context.scratchShared = false;
    env->DeleteLocalRef(bytes);
    env->DeleteLocalRef(order);
    env->DeleteLocalRef(orderClass);
    env->DeleteLocalRef(bufferClass);
    env->DeleteLocalRef(buffer);
  }

} // namespace

JavaContext::~JavaContext() {
  if (scratchBuffer == nullptr && scratchBytes == nullptr) {
    return;
  }
  // The Runtime may be destroyed on a thread that is not attached to the JVM yet.
  facebook::jni::ThreadScope scope;
  JNIEnv* currentEnv = facebook::jni::Environment::current();
  if (scratchSlot >= 0) {
    jclass clazz = directCallClass(currentEnv);
    static const jmethodID unregisterScratch = currentEnv->GetStaticMethodID(clazz, "unregisterScratch", "(I)V");
    currentEnv->CallStaticVoidMethod(clazz, unregisterScratch, scratchSlot);
    currentEnv->ExceptionClear();
  }
  if (scratchBuffer != nullptr) {
    currentEnv->DeleteGlobalRef(scratchBuffer);
  }
  if (scratchBytes != nullptr) {
    currentEnv->DeleteGlobalRef(scratchBytes);
  }
}

std::shared_ptr<JavaContext> JavaContext::get(jsi::Runtime& runtime) {
  return detail::RuntimeData::getOrCreate(runtime, RUNTIME_DATA_UUID, [] {
    auto context = std::make_shared<JavaContext>();
    JNIEnv* env = facebook::jni::Environment::current();
    context->env = env;
    if (!useSharedScratch(env, *context)) {
      useCopyingScratch(env, *context);
    }
    jclass clazz = directCallClass(env);
    static const jmethodID registerScratch = env->GetStaticMethodID(clazz, "registerScratch", "([BLjava/nio/ByteBuffer;)I");
    context->scratchSlot = env->CallStaticIntMethod(clazz, registerScratch, context->scratchBytes, context->scratchBuffer);
    facebook::jni::throwPendingJniExceptionAsCppException();
    return context;
  });
}

void copyScratchToJavaBytesSlow(JavaContext& context, size_t length) {
  context.env->SetByteArrayRegion(context.scratchBytes, 0, static_cast<jsize>(length), reinterpret_cast<const jbyte*>(context.scratchData));
}

void copyJavaBytesToScratchSlow(JavaContext& context, jint length) {
  context.env->GetByteArrayRegion(context.scratchBytes, 0, length, reinterpret_cast<jbyte*>(context.scratchData));
}

jsi::Value takePendingJavaString(jsi::Runtime& runtime, JavaContext& context) {
  JNIEnv* env = context.env;
  jclass clazz = directCallClass(env);
  static const jmethodID takePendingString = env->GetStaticMethodID(clazz, "takePendingString", "()Ljava/lang/String;");
  auto string = facebook::jni::adopt_local(static_cast<jstring>(env->CallStaticObjectMethod(clazz, takePendingString)));
  facebook::jni::throwPendingJniExceptionAsCppException();
  if (string == nullptr) [[unlikely]] {
    throw jsi::JSError(runtime, "A Kotlin bridge reported a string result, but none was pending.");
  }
  return jsi::String::createFromUtf8(runtime, string->toStdString());
}

void throwJavaException(jsi::Runtime& runtime, JavaContext& context, const char* name) {
  JNIEnv* env = context.env;
  jthrowable throwable = env->ExceptionOccurred();
  env->ExceptionClear();
  std::string message = "unknown Java exception";
  try {
    auto exception = facebook::jni::adopt_local(throwable);
    message = exception->toString();
  } catch (...) {
    env->ExceptionClear();
  }
  throwError(runtime, name, message);
}
#endif

} // namespace margelo::nitro::direct
