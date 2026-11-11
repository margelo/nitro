//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

// Forward declare a few of the common types that might have cyclic includes.
namespace margelo::nitro {
template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include "JSIConverter.hpp"

#include "AnyMap.hpp"
#include <jsi/jsi.h>
#include <vector>

namespace margelo::nitro {

using namespace facebook;

// std::vector<T> <> T[]
template <typename ElementType>
struct JSIConverter<std::vector<ElementType>> final {
  static inline std::vector<ElementType> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    jsi::Array array = arg.asObject(runtime).asArray(runtime);
    size_t length = array.size(runtime);

    std::vector<ElementType> vector;
    vector.reserve(length);
    for (size_t i = 0; i < length; ++i) {
      jsi::Value elementValue = array.getValueAtIndex(runtime, i);
      vector.emplace_back(JSIConverter<ElementType>::fromJSI(runtime, elementValue));
    }
    return vector;
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::vector<ElementType>& vector) {
    jsi::Array array(runtime, vector.size());
    for (size_t i = 0; i < vector.size(); i++) {
      jsi::Value value = JSIConverter<ElementType>::toJSI(runtime, vector[i]);
      array.setValueAtIndex(runtime, i, std::move(value));
    }
    return array;
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) {
      return false;
    }
    jsi::Object object = value.getObject(runtime);
    if (!object.isArray(runtime)) {
      return false;
    }
    jsi::Array array = object.getArray(runtime);
    if (array.size(runtime) == 0) {
      // it is an empty array, so it _theoretically_ doesn't matter what type it holds. Just say true.
      return true;
    }
    // Check the type of the first element in the array.
    // Technically the array can also have different types for each item,
    // and to be absolutely sure that we can convert the entire array, we have to check each item in the array.
    // But we don't want to do that for performance reasons - let's just assume the user doesn't make this mistake.
    jsi::Value firstElement = array.getValueAtIndex(runtime, 0);
    return JSIConverter<ElementType>::canConvert(runtime, firstElement);
  }
};

} // namespace margelo::nitro
