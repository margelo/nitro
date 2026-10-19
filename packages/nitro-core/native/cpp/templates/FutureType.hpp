//
//  FutureType.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 21.06.24.
//

#pragma once

#include <future>
#include <type_traits>

namespace margelo::nitro {

// Gets the `T` in `std::future<T>`.
template <typename T>
struct future_type {
  using type = void;
};
template <typename T>
struct future_type<std::future<T>> {
  using type = T;
};

template <typename T>
using future_type_v = typename future_type<std::remove_reference_t<T>>::type;

} // namespace margelo::nitro
