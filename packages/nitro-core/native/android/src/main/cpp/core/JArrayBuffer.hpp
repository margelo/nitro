//
//  JArrayBuffer.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "ByteBufferArrayBuffer.hpp"
#include "HardwareBufferArrayBuffer.hpp"
#include "JRunnable.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <android/hardware_buffer.h>
#include <android/hardware_buffer_jni.h>
#include <fbjni/ByteBuffer.h>
#include <fbjni/fbjni.h>
#include <functional>
#include <utility>

namespace margelo::nitro {

namespace jni = facebook::jni;

/**
 * Represents a `ArrayBuffer` that can either hold a `ByteBuffer` (owning),
 * or unknown/foreign memory, potentially from JS (non-owning).
 */
class JArrayBuffer final : public jni::HybridClass<JArrayBuffer> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/ArrayBuffer;";

public:
  /**
   * Create a new `JArrayBuffer` that wraps the given ArrayBuffer.
   */
  static jni::local_ref<JArrayBuffer::javaobject> wrap(const ArrayBuffer& arrayBuffer) {
    return newObjectCxxArgs(arrayBuffer);
  }

public:
  /**
   * Create a new `JArrayBuffer` that wraps the given `ByteBuffer` from Java.
   * The optional `onDelete` `Runnable` runs once the last owner released the buffer.
   */
  static jni::local_ref<JArrayBuffer::jhybriddata>
  initHybridByteBuffer(jni::alias_ref<jhybridobject>, jni::alias_ref<jni::JByteBuffer> buffer, jni::alias_ref<JRunnable> onDelete) {
    return makeCxxInstance(buffer, onDelete);
  }
  /**
   * Create a new `JArrayBuffer` that wraps the given `HardwareBuffer` from Java.
   * The optional `onDelete` `Runnable` runs once the last owner released the buffer.
   */
  static jni::local_ref<JArrayBuffer::jhybriddata>
  initHybridHardwareBuffer(jni::alias_ref<jhybridobject>, [[maybe_unused]] jni::alias_ref<jni::JObject> boxedHardwareBuffer,
                           [[maybe_unused]] jni::alias_ref<JRunnable> onDelete) {
#if __ANDROID_API__ >= 26
    // Cast jobject* to AHardwareBuffer*. It has a retain count of 0 which will be retained in `HardwareBufferArrayBuffer(..)`.
    AHardwareBuffer* hardwareBuffer = AHardwareBuffer_fromHardwareBuffer(jni::Environment::current(), boxedHardwareBuffer.get());
    return makeCxxInstance(hardwareBuffer, onDelete);
#else
    throw std::runtime_error("ArrayBuffer(HardwareBuffer) requires NDK API 26 or above! (minSdk >= 26)");
#endif
  }

public:
  /**
   * Get whether the `ArrayBuffer` is holding data from a `ByteBuffer`.
   */
  bool getIsByteBuffer() {
    auto byteBufferArrayBuffer = std::dynamic_pointer_cast<ByteBufferArrayBuffer>(_arrayBuffer.getNativeBuffer());
    return byteBufferArrayBuffer != nullptr;
  }

  /**
   * Get whether the `ArrayBuffer` is holding data from a `HardwareBuffer`.
   */
  bool getIsHardwareBuffer() {
#if __ANDROID_API__ >= 26
    auto hardwareBufferArrayBuffer = std::dynamic_pointer_cast<HardwareBufferArrayBuffer>(_arrayBuffer.getNativeBuffer());
    return hardwareBufferArrayBuffer != nullptr;
#else
    return false;
#endif
  }

  /**
   * Get whether the `ArrayBuffer` is owning the data and can safely hold onto it longer.
   */
  bool getIsOwner() {
    return _arrayBuffer.isOwner();
  }

  /**
   * Get the `ArrayBuffer`'s data as a `ByteBuffer`.
   *
   * - If the `ArrayBuffer` was created from a `ByteBuffer` (`isByteBuffer()`), this returns
   * a reference to the original `ByteBuffer`, which is safe to be kept in memory for longer.
   * - If the `ArrayBuffer` was created elsewhere (either in JS, or in C++), it does not have a
   * `ByteBuffer`. In this case, this **wraps** the data in a new `ByteBuffer` without retaining it.
   * The caller has to keep the data alive while the `ByteBuffer` is used, e.g. with `retainArrayBuffer()`.
   */
  [[nodiscard]] jni::local_ref<jni::JByteBuffer> getByteBuffer() {
    auto byteBufferArrayBuffer = std::dynamic_pointer_cast<ByteBufferArrayBuffer>(_arrayBuffer.getNativeBuffer());
    if (byteBufferArrayBuffer != nullptr) {
      // It is a `ByteBufferArrayBuffer`, which has a `ByteBuffer` underneath!
      return jni::make_local(byteBufferArrayBuffer->getBuffer());
    }
    // It is a different kind of `ArrayBuffer`, we need to wrap the data.
    size_t size = _arrayBuffer.size();
    if (size == 0) {
      auto buffer = jni::JByteBuffer::allocateDirect(0);
      buffer->order(jni::JByteOrder::nativeOrder());
      return buffer;
    }
    auto buffer = jni::JByteBuffer::wrapBytes(_arrayBuffer.data(), size);
    buffer->order(jni::JByteOrder::nativeOrder());
    return buffer;
  }

  /**
   * Copy the `ArrayBuffer`'s data into a new owning `ArrayBuffer` in native memory.
   */
  [[nodiscard]] jni::local_ref<JArrayBuffer::javaobject> copyNative() {
    return wrap(ArrayBuffer::copy(_arrayBuffer));
  }

  /**
   * Allocate a new owning `ArrayBuffer` of the given size in native memory, without initializing it.
   */
  static jni::local_ref<JArrayBuffer::javaobject> allocateNative(jni::alias_ref<jni::JClass>, jint size) {
    return wrap(ArrayBuffer::allocate(static_cast<size_t>(size)));
  }

  /**
   * Create a new reference to this `ArrayBuffer`'s data that stays valid after this `JArrayBuffer`
   * is destroyed. Release it with `releaseArrayBuffer(...)`.
   */
  [[nodiscard]] jlong retainArrayBuffer() {
    return reinterpret_cast<jlong>(new ArrayBuffer(_arrayBuffer));
  }

  /**
   * Release a reference created with `retainArrayBuffer()`.
   */
  static void releaseArrayBuffer(jni::alias_ref<jni::JClass>, jlong reference) {
    delete reinterpret_cast<ArrayBuffer*>(reference);
  }

  [[nodiscard]] jni::local_ref<jni::JObject> getHardwareBufferBoxed() {
#if __ANDROID_API__ >= 26
    AHardwareBuffer* buffer = getHardwareBuffer();
    jobject boxed = AHardwareBuffer_toHardwareBuffer(jni::Environment::current(), buffer);
    jni::throwPendingJniExceptionAsCppException();
    return jni::adopt_local(boxed);
#else
    throw std::runtime_error("ArrayBuffer(HardwareBuffer) requires NDK API 26 or above! (minSdk >= 26)");
#endif
  }

  int getBufferSize() {
    return static_cast<int>(_arrayBuffer.size());
  }

public:
  /**
   * Get the underlying `ArrayBuffer`.
   */
  [[nodiscard]] ArrayBuffer getArrayBuffer() const {
    return _arrayBuffer;
  }
  /**
   * Get the underlying `HardwareBuffer` if it has one.
   * This method will throw if this `ArrayBuffer` was not created with a `HardwareBuffer`.
   */
  [[nodiscard]] AHardwareBuffer* getHardwareBuffer() const {
#if __ANDROID_API__ >= 26
    auto hardwareBufferArrayBuffer = std::dynamic_pointer_cast<HardwareBufferArrayBuffer>(_arrayBuffer.getNativeBuffer());
    if (hardwareBufferArrayBuffer != nullptr) {
      return hardwareBufferArrayBuffer->getBuffer();
    } else {
      throw std::runtime_error("The underlying buffer is not a HardwareBuffer!");
    }
#else
    throw std::runtime_error("ArrayBuffer(HardwareBuffer) requires NDK API 26 or above! (minSdk >= 26)");
#endif
  }

private:
  explicit JArrayBuffer(const ArrayBuffer& arrayBuffer) : _arrayBuffer(arrayBuffer) {}
  JArrayBuffer(const jni::alias_ref<jni::JByteBuffer>& byteBuffer, const jni::alias_ref<JRunnable>& onDelete)
      : _arrayBuffer(std::make_shared<ByteBufferArrayBuffer>(byteBuffer, onDelete)) {}

#if __ANDROID_API__ >= 26
  JArrayBuffer(AHardwareBuffer* /* 0 retain */ hardwareBuffer, const jni::alias_ref<JRunnable>& onDelete)
      : _arrayBuffer(std::make_shared<HardwareBufferArrayBuffer>(hardwareBuffer, onDelete)) {}
#endif

private:
  friend HybridBase;
  using HybridBase::HybridBase;
  ArrayBuffer _arrayBuffer;

public:
  static void registerNatives() {
    registerHybrid(
        {makeNativeMethod("initHybrid", JArrayBuffer::initHybridByteBuffer),
         makeNativeMethod("initHybridBoxedHardwareBuffer", JArrayBuffer::initHybridHardwareBuffer),
         makeNativeMethod("getByteBuffer", JArrayBuffer::getByteBuffer), makeNativeMethod("copyNative", JArrayBuffer::copyNative),
         makeNativeMethod("allocateNative", JArrayBuffer::allocateNative),
         makeNativeMethod("retainArrayBuffer", JArrayBuffer::retainArrayBuffer),
         makeNativeMethod("releaseArrayBuffer", JArrayBuffer::releaseArrayBuffer),
         makeNativeMethod("getIsByteBuffer", JArrayBuffer::getIsByteBuffer),
         makeNativeMethod("getHardwareBufferBoxed", JArrayBuffer::getHardwareBufferBoxed),
         makeNativeMethod("getIsHardwareBuffer", JArrayBuffer::getIsHardwareBuffer),
         makeNativeMethod("getIsOwner", JArrayBuffer::getIsOwner), makeNativeMethod("getBufferSize", JArrayBuffer::getBufferSize)});
  }
};

} // namespace margelo::nitro
