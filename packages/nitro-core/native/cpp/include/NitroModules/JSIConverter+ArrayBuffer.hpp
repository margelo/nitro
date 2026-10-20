//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/ArrayBuffer.hpp>
#include <NitroModules/JSICache.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <cassert>
#include <jsi/jsi.h>
#include <memory>
#include <type_traits>

namespace margelo::nitro {

using namespace facebook;

// MutableBuffer <> ArrayBuffer
template <>
struct JSIConverter<ArrayBuffer> final {
  static inline ArrayBuffer fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
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

    jsi::ArrayBuffer jsArrayBuffer = std::move(object).getArrayBuffer(runtime);
    if (auto mutableBuffer = jsArrayBuffer.tryGetMutableBuffer(runtime)) {
      return ArrayBuffer(std::move(mutableBuffer));
    }

    JSICache& cache = JSICache::getOrCreateCache(runtime);
    BorrowingReference<jsi::ArrayBuffer> borrowingArrayBuffer = cache.makeShared(std::move(jsArrayBuffer));

    JSArrayBuffer jsBuffer(runtime, std::move(borrowingArrayBuffer));
    return ArrayBuffer(std::move(jsBuffer));
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const ArrayBuffer& buffer) {
    if (auto* jsBuffer = std::get_if<JSArrayBuffer>(&buffer._impl)) {
      // It's already a JS ArrayBuffer! Just return as-is (copy the reference).
      assert(&runtime == &jsBuffer->_runtime.get() && "Cannot reuse a JS ArrayBuffer across different JS Runtimes!");
      jsi::ArrayBuffer& arrayBuffer = *jsBuffer->_jsReference;
      return jsi::Value(runtime, arrayBuffer);
    } else {
      // It's a native buffer! Return jsi::ArrayBuffer from NativeBuffer.
      auto& nativeBuffer = std::get<NativeArrayBuffer>(buffer._impl);
      jsi::ArrayBuffer arrayBuffer = jsi::ArrayBuffer(runtime, nativeBuffer);
      size_t size = nativeBuffer->size();
      if (size > 0) {
        arrayBuffer.setExternalMemoryPressure(runtime, size);
      }
      return std::move(arrayBuffer);
    }
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
