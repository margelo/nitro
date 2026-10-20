//
//  SwiftConverter.hpp
//  NitroModules
//

#pragma once

#include <NitroModules/SwiftConverter_fwd.hpp>

// Use the consuming module's Swift definitions to avoid duplicate C++ type metadata.
#ifndef SWIFT_SWIFT_H
#error Include your generated -Swift.h header before SwiftConverter.hpp.
#endif

#include <concepts>

namespace margelo::nitro {

/**
 * Converts C++ type T to and from its SwiftType without a JavaScript runtime.
 * Types with Swift interop metadata (primitives, exported Swift types, and imported C++ types) pass through unchanged.
 * Specialize SwiftConverter<T> to provide a different Swift representation.
 * Use SwiftConverter<T, SwiftTarget> when the same C++ type has different Swift representations across modules.
 */
template <typename T, typename SwiftTarget>
struct SwiftConverter final {
  // Containers pass their element's Swift target explicitly. For example,
  // SwiftConverter<std::string, swift::String> reuses SwiftConverter<std::string>.
  static_assert(std::same_as<SwiftTarget, typename SwiftConverter<T>::SwiftType>,
                "This Swift target needs its own SwiftConverter specialization.");
  using SwiftType = SwiftTarget;

  static T fromSwift(const SwiftType& value) {
    return SwiftConverter<T>::fromSwift(value);
  }

  static SwiftType toSwift(const T& value) {
    return SwiftConverter<T>::toSwift(value);
  }
};

// Types without a default representation do not satisfy SwiftConvertible.
template <typename T>
struct SwiftConverter<T> final {
  SwiftConverter() = delete;
};

// Swift's generated header supplies metadata for types that can pass through unchanged.
template <typename T>
  requires swift::isUsableInGenericContext<T>
struct SwiftConverter<T> final {
  SwiftConverter() = delete;

  using SwiftType = T;

  static inline T fromSwift(const SwiftType& value) {
    return value;
  }

  static inline SwiftType toSwift(const T& value) {
    return value;
  }
};

// Void has no value to convert, but is a valid callback result.
template <>
struct SwiftConverter<void> final {
  using SwiftType = void;
};

/**
 * Requires a bidirectional converter whose SwiftType can be used in Swift generics.
 * Unsupported types evaluate to false, including unsupported elements in arrays and optionals.
 */
template <typename T>
concept SwiftConvertible = requires(const T& cppValue, const typename SwiftConverter<T>::SwiftType& swiftValue) {
  requires swift::isUsableInGenericContext<typename SwiftConverter<T>::SwiftType>;
  { SwiftConverter<T>::fromSwift(swiftValue) } -> std::same_as<T>;
  { SwiftConverter<T>::toSwift(cppValue) } -> std::same_as<typename SwiftConverter<T>::SwiftType>;
};

} // namespace margelo::nitro

#include <NitroModules/SwiftConverter+AnyJSON.hpp>
#include <NitroModules/SwiftConverter+Array.hpp>
#include <NitroModules/SwiftConverter+Optional.hpp>
#include <NitroModules/SwiftConverter+Promise.hpp>
#include <NitroModules/SwiftConverter+String.hpp>
#include <NitroModules/SwiftConverter+Callback.hpp>
