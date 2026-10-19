//
//  InstanceMethod.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 25.09.25.
//

#pragma once

#include "NitroDefines.hpp"

namespace margelo::nitro {

/**
 * Represents a Function pointer to an instance method of the given class.
 * For example:
 * `InstanceMethod<std::string, size_t>` could point to `size_t std::string::length()`
 * `InstanceMethod<std::vector<int>, void, int>` could point to `void std::vector<int>::push_back(int)`
 */
template <typename T, typename ReturnType, typename... Args>
using InstanceMethod = ReturnType (T::*NON_NULL)(Args...);

} // namespace margelo::nitro
