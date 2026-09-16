//
//  FastVectorCopy.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 22.09.25.
//

#pragma once

#include "NitroDefines.hpp"
#include <cstring>
#include <span>
#include <type_traits>
#include <vector>

namespace margelo::nitro {

static constexpr bool enableFastVectorCopy = false;

/**
 * Copies `data` into an `std::vector` as fast as possible.
 *
 * If the type is trivially copyable (aka if it does not have a copy constructor),
 * the data will be bulk-memcopied.
 */
template <typename T>
[[deprecated("FastVectorCopy is not safe for Swift - upgrade Nitro!")]]
std::vector<T> FastVectorCopy(const T* CONTIGUOUS_MEMORY NON_NULL data, size_t size) {
  assert(data != nullptr && "FastVectorCopy: data cannot be null!");

  if (size == 0) [[unlikely]] {
    // It's an empty vector.
    return std::vector<T>();
  }

  if constexpr (std::is_trivially_copyable_v<T> && enableFastVectorCopy) {
    // FAST: Type does not have a copy constructor - simply memcpy it
    std::vector<T> vector(size);
    std::memcpy(vector.data(), data, size * sizeof(T));
    return vector;
  } else {
    // SLOW: Type needs to be iterated to copy-construct it
    return std::vector<T>(data, data + size);
  }
}

} // namespace margelo::nitro
