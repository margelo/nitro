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
    static_cast<std::string*>(target)->assign(reinterpret_cast<const char*>(utf8), length);
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

void StringData::append(bool ascii, const void* data, size_t count) {
  if (ascii && _isASCII) {
    _ascii.append(static_cast<const char*>(data), count);
    return;
  }
  if (_isASCII) {
    // Switch to UTF-16 and widen what was copied so far.
    _utf16.assign(_ascii.begin(), _ascii.end());
    _isASCII = false;
  }
  if (ascii) {
    const char* characters = static_cast<const char*>(data);
    _utf16.append(characters, characters + count);
  } else {
    _utf16.append(static_cast<const char16_t*>(data), count);
  }
}

void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result) {
  jsi::String string = value.getString(runtime);
  auto append = [&result](bool ascii, const void* data, size_t count) { result.append(ascii, data, count); };
  string.getStringData(runtime, append);
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

  /** Wraps `JavaContext::scratch` in a direct `ByteBuffer`, with a separate `byte[]` that strings are copied through. */
  void createScratch(JNIEnv* env, JavaContext& context) {
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
    createScratch(env, *context);
    return context;
  });
}

bool appendASCII(jsi::Runtime& runtime, const jsi::Value& value, JavaContext& context, size_t& offset, jint& length) {
  jsi::String string = value.getString(runtime);
  uint8_t* target = context.scratch + offset;
  size_t capacity = kScratchSize - offset;
  size_t written = 0;
  bool fits = true;
  auto append = [&](bool ascii, const void* data, size_t count) {
    if (!fits || count > capacity - written) {
      fits = false;
      return;
    }
    if (ascii) {
      memcpy(target + written, data, count);
    } else {
      const char16_t* characters = static_cast<const char16_t*>(data);
      for (size_t i = 0; i < count; i++) {
        if (characters[i] >= 0x80) {
          fits = false;
          return;
        }
        target[written + i] = static_cast<uint8_t>(characters[i]);
      }
    }
    written += count;
  };
  string.getStringData(runtime, append);
  if (!fits) [[unlikely]] {
    return false;
  }
  length = static_cast<jint>(written);
  offset += written;
  return true;
}

void copyScratchToJavaBytes(JavaContext& context, size_t length) {
  context.env->SetByteArrayRegion(context.scratchBytes, 0, static_cast<jsize>(length), reinterpret_cast<const jbyte*>(context.scratch));
}

jsi::Value stringFromJavaBytes(jsi::Runtime& runtime, JavaContext& context, jint length) {
  context.env->GetByteArrayRegion(context.scratchBytes, 0, length, reinterpret_cast<jbyte*>(context.scratch));
  return jsi::String::createFromAscii(runtime, reinterpret_cast<const char*>(context.scratch), static_cast<size_t>(length));
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
