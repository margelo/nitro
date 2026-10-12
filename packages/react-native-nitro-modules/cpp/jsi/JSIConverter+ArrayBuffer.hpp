//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

// Forward declare a few of the common types that might have cyclic includes.
namespace margelo::nitro {
class ArrayBuffer;
class JSICache;

template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include "JSIConverter.hpp"

#include "ArrayBuffer.hpp"
#include "IsSharedPtrTo.hpp"
#include "JSICache.hpp"
#include "NitroDefines.hpp"
#include <jsi/jsi.h>
#include <memory>

namespace margelo::nitro {

using namespace facebook;

struct MutableBufferNativeState final : public jsi::NativeState {
public:
  explicit MutableBufferNativeState(const std::shared_ptr<jsi::MutableBuffer>& buffer) : buffer(buffer) {}
  std::shared_ptr<jsi::MutableBuffer> buffer;
};

// MutableBuffer <> ArrayBuffer
template <typename T>
  requires SharedPtrTo<T, jsi::MutableBuffer>
struct JSIConverter<T> final {
  static inline std::shared_ptr<ArrayBuffer> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
#ifdef NITRO_DEBUG
    if (!arg.isObject()) [[unlikely]] {
      throw std::invalid_argument("Value \"" + arg.toString(runtime).utf8(runtime) +
                                  "\" is not an ArrayBuffer - "
                                  "in fact, it's not even an object!");
    }
#endif

    jsi::Object object = arg.asObject(runtime);
#ifdef NITRO_DEBUG
    if (!object.isArrayBuffer(runtime)) [[unlikely]] {
      throw std::invalid_argument("Object \"" + arg.toString(runtime).utf8(runtime) +
                                  "\" is not an ArrayBuffer! "
                                  "Are you maybe passing a TypedArray (e.g. Uint8Array)? Try to pass its `.buffer` value.");
    }
#endif
    if (object.hasNativeState<MutableBufferNativeState>(runtime)) {
      // It already is a NativeBuffer! Let's get the jsi::MutableBuffer from the jsi::NativeState...
      auto mutableBufferHolder = object.getNativeState<MutableBufferNativeState>(runtime);
      auto mutableBuffer = mutableBufferHolder->buffer;
      if (auto arrayBuffer = std::dynamic_pointer_cast<ArrayBuffer>(mutableBuffer)) [[likely]] {
        return arrayBuffer;
      }
    }

    BorrowingReference<jsi::ArrayBuffer> borrowingArrayBuffer;
    {
      JSICacheReference cache = JSICache::getOrCreateCache(runtime);
      borrowingArrayBuffer = cache.makeShared(object.getArrayBuffer(runtime));
    }

    return std::make_shared<JSArrayBuffer>(runtime, borrowingArrayBuffer);
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::shared_ptr<jsi::MutableBuffer>& buffer) {
    if (auto jsBuffer = std::dynamic_pointer_cast<JSArrayBuffer>(buffer)) {
      // It already is a JSBuffer! Let's try to just get its existing jsi::Value...
      auto jsValue = jsBuffer->getJSReference();
      if (jsValue != nullptr) [[likely]] {
        return jsi::Value(runtime, *jsValue);
      }
    }

    // 1. Create jsi::ArrayBuffer
    jsi::ArrayBuffer arrayBuffer(runtime, buffer);
    // 2. Wrap jsi::MutableBuffer in jsi::NativeState holder & attach it
    auto mutableBufferHolder = std::make_shared<MutableBufferNativeState>(buffer);
    arrayBuffer.setNativeState(runtime, mutableBufferHolder);
    // 3. Notify the JS VM about memory retained outside of its heap
    if (auto nitroBuffer = std::dynamic_pointer_cast<ArrayBuffer>(buffer)) {
      size_t externalMemorySize = nitroBuffer->getExternalMemorySize();
      if (externalMemorySize > 0) {
        arrayBuffer.setExternalMemoryPressure(runtime, externalMemorySize);
      }
    }
    // 4. Return jsi::ArrayBuffer (with jsi::NativeState) to JS
    return arrayBuffer;
  }
  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isObject()) {
      jsi::Object object = value.getObject(runtime);
      return object.isArrayBuffer(runtime);
    }
    return false;
  }
};

} // namespace margelo::nitro
