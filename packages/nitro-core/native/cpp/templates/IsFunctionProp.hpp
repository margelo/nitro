//
//  IsFunctionProp.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 21.06.24.
//

#pragma once

#include <type_traits>

namespace margelo::nitro {

template <typename T>
struct IsFunctionProp : std::false_type {};

template <typename TResult, typename... TArgs>
struct IsFunctionProp<std::function<TResult(TArgs...)>> : std::true_type {};

template <typename T>
struct IsFunctionProp<std::optional<T>> : IsFunctionProp<T> {};

} // namespace margelo::nitro
