//
//  NitroHash.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "NitroDefines.hpp"
#include <cstddef>
#include <cstdint>
#include <string>

namespace margelo::nitro {

/**
 * Hashes the given C-String using the FNV-1a hashing algorithm.
 *
 * This function can be used at compile time as a constexpr to build
 * statically optimized switch statements.
 */
constexpr uint64_t hashString(const char* NON_NULL str, size_t length) {
  uint64_t hash = 14695981039346656037ull; // FNV offset basis
  const uint64_t fnv_prime = 1099511628211ull;

  for (size_t i = 0; i < length; ++i) {
    hash ^= static_cast<uint64_t>(str[i]);
    hash *= fnv_prime;
  }

  return hash;
}

/**
 * Hashes the given constant C-String using the FNV-1a hashing algorithm.
 *
 * String length is known at compile time.
 */
template <size_t N>
constexpr uint64_t hashString(const char (&str)[N]) {
  return hashString(str, N - 1); // N includes the null terminator, so subtract 1
}

/**
 * Hashes the given `string_view` using the FNV-1a hashing algorithm.
 * This can be constexpr.
 */
constexpr uint64_t hashString(const std::string_view& string) {
  return hashString(string.data(), string.length());
}

/**
 * Hashes the given `string` using the FNV-1a hashing algorithm.
 * This happens at runtime.
 */
inline uint64_t hashString(const std::string& string) {
  return hashString(string.c_str(), string.length());
}

} // namespace margelo::nitro
