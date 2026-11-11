//
//  TypeIndex.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 21.06.24.
//

#pragma once

#include <tuple>
#include <type_traits>

namespace margelo::nitro {

// Gets the index of `T` in a `std::tuple<...>`.
template <typename T, typename... Ts>
struct type_index;

template <typename T, typename First, typename... Rest>
struct type_index<T, First, Rest...> {
  static constexpr size_t value = std::is_same_v<T, First> ? 0 : 1 + type_index<T, Rest...>::value;
};

template <typename T>
struct type_index<T> {
  static constexpr size_t value = -1; // Type not found
};

} // namespace margelo::nitro
