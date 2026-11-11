//
//  IsSharedPtrTo.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 21.06.24.
//

#pragma once

#include <type_traits>

namespace margelo::nitro {

using namespace facebook;

// Returns whether the given type T is a shared_ptr to type P.
template <typename T, typename P>
struct is_shared_ptr_to : std::false_type {};

template <typename T, typename P>
struct is_shared_ptr_to<std::shared_ptr<T>, P> : std::is_base_of<typename std::remove_cv<typename std::remove_reference<P>::type>::type,
                                                                 typename std::remove_cv<typename std::remove_reference<T>::type>::type> {};

template <typename T, typename P>
constexpr bool is_shared_ptr_to_v = is_shared_ptr_to<T, P>::value;

} // namespace margelo::nitro
