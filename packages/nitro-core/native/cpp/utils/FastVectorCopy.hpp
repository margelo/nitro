//
//  FastVectorCopy.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 22.09.25.
//

#pragma once

#include "NitroDefines.hpp"
#include <span>
#include <type_traits>
#include <vector>

namespace margelo::nitro {

/**
 * Copies `data` into an `std::vector` as fast as possible.
 *
 * If the type is trivially copyable (aka if it does not have a copy constructor),
 * the data will be bulk-memcopied.
 */
template <typename T>
[[deprecated("FastVectorCopy is not safe for Swift - upgrade Nitro!")]]
std::vector<T> FastVectorCopy(const T* CONTIGUOUS_MEMORY NON_NULL data, size_t size) {
  assert(data != nullptr && "FastVectoryCopy: data cannot be null!");

  if (size == 0) [[unlikely]] {
    // It's an empty vector.
    return std::vector<T>();
  }

  if constexpr (std::is_trivially_copyable_v<T>) {
    // FAST: Type does not have a copy constructor - simply memcpy it
    std::vector<T> vector(size);
    std::memcpy(vector.data(), data, size * sizeof(T));
    return vector;
  } else {
    // SLOW: Type needs to be iterated to copy-construct it
    std::span<const T> span(data, size);
    return std::vector<T>(span.begin(), span.end());
  }
}

} // namespace margelo::nitro
