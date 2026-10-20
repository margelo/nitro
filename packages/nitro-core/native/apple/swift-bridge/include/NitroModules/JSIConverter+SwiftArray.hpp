//
//  JSIConverter+SwiftArray.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 30.09.26.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>

#include <NitroModules/JSIConverter+SwiftString.hpp>

// Use the consuming module's Swift definitions. Including another module's -Swift.h
// here can redefine metadata for C++ types exported by both modules.
#ifndef SWIFT_SWIFT_H
#error Include your generated -Swift.h header before JSIConverter+SwiftArray.hpp.
#endif

#include <array>
#include <vector>

namespace margelo::nitro {

using namespace facebook;

// swift::Array<T> <> T[]
template <typename ElementType>
struct JSIConverter<swift::Array<ElementType>> final {
  static inline swift::Array<ElementType> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSIDecodable<ElementType>
  {
    jsi::Array array = value.asObject(runtime).asArray(runtime);
    size_t length = array.size(runtime);

    swift::Array<ElementType> result = swift::Array<ElementType>::init();
    result.reserveCapacity(static_cast<swift::Int>(length));
    for (size_t i = 0; i < length; ++i) {
      jsi::Value elementValue = array.getValueAtIndex(runtime, i);
      result.append(JSIConverter<ElementType>::fromJSI(runtime, elementValue));
    }
    return result;
  }

  static inline jsi::Array toJSI(jsi::Runtime& runtime, const swift::Array<ElementType>& value)
    requires JSIEncodable<ElementType>
  {
    jsi::Array array(runtime, 0);
    size_t length = static_cast<size_t>(value.getCount());
    if (length == 0) {
      return array;
    }
    // Match the vector converter's single push(...) path, with a stack buffer for small arrays.
    constexpr size_t kInlineCapacity = 8;
    if (length <= kInlineCapacity) {
      std::array<jsi::Value, kInlineCapacity> values;
      pushItems(runtime, array, value, values.data(), length);
    } else {
      std::vector<jsi::Value> values(length);
      pushItems(runtime, array, value, values.data(), length);
    }
    return array;
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSITypeCheckable<ElementType>
  {
    if (!value.isObject()) {
      return false;
    }
    jsi::Object object = value.getObject(runtime);
    if (!object.isArray(runtime)) {
      return false;
    }
    jsi::Array array = object.getArray(runtime);
    if (array.size(runtime) == 0) {
      return true;
    }
    // As with std::vector, check only the first element to keep type checks cheap.
    jsi::Value firstElement = array.getValueAtIndex(runtime, 0);
    return JSIConverter<ElementType>::canConvert(runtime, firstElement);
  }

private:
  static inline void pushItems(jsi::Runtime& runtime, jsi::Array& array, const swift::Array<ElementType>& value, jsi::Value* values,
                               size_t length)
    requires JSIEncodable<ElementType>
  {
    for (size_t i = 0; i < length; ++i) {
      values[i] = JSIConverter<ElementType>::toJSI(runtime, value[static_cast<swift::Int>(i)]);
    }
    // The pointer has to be const, otherwise this resolves to the variadic push(Args&&...) overload.
    array.push(runtime, static_cast<const jsi::Value*>(values), length);
  }
};

} // namespace margelo::nitro
