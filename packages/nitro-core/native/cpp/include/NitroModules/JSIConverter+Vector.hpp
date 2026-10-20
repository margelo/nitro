//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <array>
#include <jsi/jsi.h>
#include <vector>

namespace margelo::nitro {

using namespace facebook;

// std::vector<T> <> T[]
template <typename ElementType>
struct JSIConverter<std::vector<ElementType>> final {
  static inline std::vector<ElementType> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg)
    requires(JSIDecodable<ElementType> && std::constructible_from<ElementType, ElementType>)
  {
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
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::vector<ElementType>& vector)
    requires requires(jsi::Runtime& rt, const std::vector<ElementType>& value) {
      { JSIConverter<ElementType>::toJSI(rt, value[0]) } -> std::convertible_to<jsi::Value>;
    }
  {
    jsi::Array array(runtime, 0);
    if (vector.empty()) {
      return array;
    }
    // Convert all items first and append them with a single push(...) - filling a pre-sized array
    // with setValueAtIndex(...) is much slower, as each item goes through the engine's slow path.
    // Small vectors use a stack buffer to avoid a heap allocation.
    constexpr size_t kInlineCapacity = 8;
    if (vector.size() <= kInlineCapacity) {
      std::array<jsi::Value, kInlineCapacity> values;
      pushItems(runtime, array, vector, values.data());
    } else {
      std::vector<jsi::Value> values(vector.size());
      pushItems(runtime, array, vector, values.data());
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

private:
  static inline void pushItems(jsi::Runtime& runtime, jsi::Array& array, const std::vector<ElementType>& vector, jsi::Value* values)
    requires JSIEncodable<const std::vector<ElementType>&>
  {
    for (size_t i = 0; i < vector.size(); i++) {
      values[i] = JSIConverter<ElementType>::toJSI(runtime, vector[i]);
    }
    // The pointer has to be const, otherwise this resolves to the variadic push(Args&&...) overload.
    array.push(runtime, static_cast<const jsi::Value*>(values), vector.size());
  }
};

} // namespace margelo::nitro
