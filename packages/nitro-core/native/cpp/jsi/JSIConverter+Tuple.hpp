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

#include "NitroTypeInfo.hpp"
#include <jsi/jsi.h>
#include <memory>
#include <tuple>

namespace margelo::nitro {

using namespace facebook;

// std::tuple<A, B, C> <> [A, B, C]
template <typename... Types>
struct JSIConverter<std::tuple<Types...>> final {
  static inline std::tuple<Types...> fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    jsi::Object object = value.asObject(runtime);
    jsi::Array array = object.asArray(runtime);
    if (array.size(runtime) != sizeof...(Types)) [[unlikely]] {
      std::string types = TypeInfo::getFriendlyTypenames<Types...>();
      throw std::length_error("The given JS Array has " + std::to_string(array.size(runtime)) + " items, but std::tuple<" + types +
                              "> expects " + std::to_string(sizeof...(Types)) + " items.");
    }

    return copyArrayItemsToTuple(runtime, array, std::index_sequence_for<Types...>{});
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::tuple<Types...>& tuple) {
    jsi::Array array(runtime, sizeof...(Types));
    copyTupleItemsToArray(runtime, array, tuple, std::index_sequence_for<Types...>{});
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
    size_t size = array.size(runtime);
    if (size != sizeof...(Types)) {
      return false;
    }

    return canConvertRecursive<Types...>(runtime, array, 0);
  }

private:
  template <std::size_t... Is>
  static inline std::tuple<Types...> copyArrayItemsToTuple(jsi::Runtime& runtime, const jsi::Array& array, std::index_sequence<Is...>) {
    return std::make_tuple(JSIConverter<Types>::fromJSI(runtime, array.getValueAtIndex(runtime, Is))...);
  }

  template <std::size_t... Is>
  static inline void copyTupleItemsToArray(jsi::Runtime& runtime, jsi::Array& array, const std::tuple<Types...>& tuple,
                                           std::index_sequence<Is...>) {
    ((array.setValueAtIndex(runtime, Is,
                            JSIConverter<std::tuple_element_t<Is, std::tuple<Types...>>>::toJSI(runtime, std::get<Is>(tuple)))),
     ...);
  }

  template <typename T>
  static bool canConvertElement(jsi::Runtime& runtime, const jsi::Array& array, size_t index) {
    return JSIConverter<T>::canConvert(runtime, array.getValueAtIndex(runtime, index));
  }

  template <typename First, typename... Rest>
  static bool canConvertRecursive(jsi::Runtime& runtime, const jsi::Array& array, size_t index) {
    if (!canConvertElement<First>(runtime, array, index)) {
      return false;
    }
    if constexpr (sizeof...(Rest) > 0) {
      return canConvertRecursive<Rest...>(runtime, array, index + 1);
    }
    return true;
  }
};

} // namespace margelo::nitro
