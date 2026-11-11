//
//  CountTrailingOptionals.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 21.06.24.
//

#pragma once

#include <optional>
#include <type_traits>

namespace margelo::nitro {

// Helper template to check if a type is std::optional
template <typename T>
struct is_optional : std::false_type {};

template <typename T>
struct is_optional<std::optional<T>> : std::true_type {};

// Helper template to count trailing optionals
template <int N = 0, typename... Args>
struct count_trailing_optionals;

template <>
struct count_trailing_optionals<> {
  static constexpr int value = 0;
};

template <int N, typename Current, typename... Rest>
struct count_trailing_optionals<N, Current, Rest...> {
  static constexpr int count_trailing_optionals_impl() {
    constexpr bool isOptional = is_optional<std::remove_cvref_t<Current>>::value;
    if constexpr (sizeof...(Rest) == 0) {
      // end of parameter pack!
      if constexpr (isOptional) {
        // last item is an optional, finally return the final number incremented by one.
        return N + 1;
      } else {
        // last item is not an optional, so there are 0 trailing optionals.
        return 0;
      }
    } else {
      // recursively look into next T, either bump N by one or reset it to 0 if it's not an optional.
      constexpr int newValue = isOptional ? N + 1 : 0;
      return count_trailing_optionals<newValue, Rest...>::count_trailing_optionals_impl();
    }
  }

  static constexpr int value = count_trailing_optionals_impl();
};

// Main template to count trailing optionals in Args... pack
template <typename... Args>
struct trailing_optionals_count {
  static constexpr int value = count_trailing_optionals<0, Args...>::value;
};

// Helper alias
template <typename... Args>
constexpr int trailing_optionals_count_v = trailing_optionals_count<std::remove_cvref_t<Args>...>::value;

} // namespace margelo::nitro
