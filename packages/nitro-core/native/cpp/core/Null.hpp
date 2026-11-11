//
// Created by Marc Rousavy on 30.07.24.
//

#pragma once

#include "NitroDefines.hpp"
#include <functional>
#include <type_traits>

namespace margelo::nitro {

/**
 * Represents the type of `null` - which should always be a singleton.
 */
enum class NullType { null };

/**
 * Represents an explicit `null` from JS.
 * This is a singleton.
 */
inline constexpr NullType null = NullType::null;

// Equality and ordering: all instances are equal
constexpr bool operator==(NullType, NullType) noexcept {
  return true;
}
constexpr bool operator!=(NullType, NullType) noexcept {
  return false;
}

} // namespace margelo::nitro

// Makes nitro::Null hashable
namespace std {
template <>
struct hash<margelo::nitro::NullType> {
  size_t operator()(margelo::nitro::NullType) const noexcept {
    return 0;
  }
};
} // namespace std
