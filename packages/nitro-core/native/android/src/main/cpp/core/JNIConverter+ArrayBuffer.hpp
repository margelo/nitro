#pragma once

#include "JArrayBuffer.hpp"
#include "JNIConverter.hpp"
#include <NitroModules/NitroDefines.hpp>
#include <stdexcept>

namespace margelo::nitro {

template <typename T>
  requires std::same_as<jni::ReprType<T>, JArrayBuffer::JavaPart>
struct JNIConverter<ArrayBuffer, jni::local_ref<T>> {
  static jni::local_ref<T> toJNI(const ArrayBuffer& value) {
    return JArrayBuffer::wrap(value);
  }

  static ArrayBuffer fromJNI(jni::alias_ref<T> value) {
#ifdef NITRO_DEBUG
    // Kotlin's `ArrayBuffer` is final, so every value has the same class.
    static const auto isClosed = value->getClass()->template getMethod<jboolean()>("isClosed");
    if (isClosed(value)) [[unlikely]] {
      throw std::runtime_error("Cannot pass an ArrayBuffer that has already been closed!");
    }
#endif
    return value->cthis()->getArrayBuffer();
  }
};

} // namespace margelo::nitro
