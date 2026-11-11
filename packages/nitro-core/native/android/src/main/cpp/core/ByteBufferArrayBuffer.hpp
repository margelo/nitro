//
//  ByteBufferArrayBuffer.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "ArrayBuffer.hpp"
#include <fbjni/ByteBuffer.h>
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents an `ArrayBuffer` that holds a `ByteBuffer`.
 */
class ByteBufferArrayBuffer final : public ArrayBuffer {
public:
  explicit ByteBufferArrayBuffer(const jni::alias_ref<jni::JByteBuffer>& byteBuffer) : _byteBuffer(jni::make_global(byteBuffer)) {
    _byteBuffer->order(jni::JByteOrder::nativeOrder());
  }

  ~ByteBufferArrayBuffer() {
    // Hermes GC can destroy JS objects on a non-JNI Thread.
    jni::ThreadScope::WithClassLoader([&] { _byteBuffer.reset(); });
  }

public:
  [[nodiscard]] uint8_t* data() override {
    return _byteBuffer->getDirectBytes();
  }
  [[nodiscard]] size_t size() const override {
    return _byteBuffer->getDirectSize();
  }
  [[nodiscard]] bool isOwner() const noexcept override {
    return _byteBuffer != nullptr && _byteBuffer->isDirect();
  }
  [[nodiscard]] size_t getExternalMemorySize() const override {
    return isOwner() ? size() : 0;
  }

public:
  [[nodiscard]] const jni::global_ref<jni::JByteBuffer>& getBuffer() const {
    return _byteBuffer;
  }

private:
  jni::global_ref<jni::JByteBuffer> _byteBuffer;
};

} // namespace margelo::nitro
