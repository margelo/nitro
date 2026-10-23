//
//  ByteBufferArrayBuffer.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "JNIGlobalRef.hpp"
#include "JRunnable.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <fbjni/ByteBuffer.h>
#include <fbjni/fbjni.h>

namespace margelo::nitro {

namespace jni = facebook::jni;
namespace jsi = facebook::jsi;

/**
 * Represents an `ArrayBuffer` that holds a `ByteBuffer`.
 * If an `onDelete` `Runnable` is given, it runs once this buffer is destroyed.
 */
class ByteBufferArrayBuffer final : public jsi::MutableBuffer {
public:
  ByteBufferArrayBuffer(const jni::alias_ref<jni::JByteBuffer>& byteBuffer, const jni::alias_ref<JRunnable>& onDelete)
      : _byteBuffer(jni::make_global(byteBuffer)), _onDelete(jni::make_global(onDelete)), _data(byteBuffer->getDirectBytes()),
        _size(byteBuffer->getDirectSize()) {
    _byteBuffer->order(jni::JByteOrder::nativeOrder());
  }

  ~ByteBufferArrayBuffer() {
    // Hermes GC can destroy JS objects on a non-JNI Thread.
    resetGlobalRef(_byteBuffer);
    runAndResetGlobalRef(_onDelete);
  }

public:
  [[nodiscard]] uint8_t* data() override {
    return _data;
  }
  [[nodiscard]] size_t size() const override {
    return _size;
  }

public:
  [[nodiscard]] const jni::global_ref<jni::JByteBuffer>& getBuffer() const {
    return _byteBuffer;
  }

private:
  jni::global_ref<jni::JByteBuffer> _byteBuffer;
  jni::global_ref<JRunnable> _onDelete;
  // Direct storage stays valid while _byteBuffer is retained. Read it without
  // JNI so owning ArrayBuffers can be used from unattached native workers.
  uint8_t* _data;
  size_t _size;
};

} // namespace margelo::nitro
