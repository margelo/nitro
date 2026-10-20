//
//  JSIConverter+SwiftOptional.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 30.09.26.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>

#include <NitroModules/detail/CountTrailingOptionals.hpp>
#include <NitroModules/JSIConverter+SwiftString.hpp>

// Use the consuming module's Swift definitions, as with the Swift array converter.
#ifndef SWIFT_SWIFT_H
#error Include your generated -Swift.h header before JSIConverter+SwiftOptional.hpp.
#endif

namespace margelo::nitro {

using namespace facebook;

namespace detail {

// Allow trailing Swift optional parameters to be omitted when calling Hybrid methods.
template <typename TInner>
struct is_optional<swift::Optional<TInner>> : std::true_type {};

} // namespace detail

// swift::Optional<T> <> T | undefined
template <typename TInner>
struct JSIConverter<swift::Optional<TInner>> final {
  static inline swift::Optional<TInner> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSIDecodable<TInner>
  {
    if (value.isUndefined()) {
      return swift::Optional<TInner>::none();
    }
    // Swift's initializer preserves the copy semantics of imported C++ payloads too.
    return swift::Optional<TInner>::init(JSIConverter<TInner>::fromJSI(runtime, value));
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const swift::Optional<TInner>& value)
    requires JSIEncodable<TInner>
  {
    if (value.isNone()) {
      return jsi::Value::undefined();
    }
    return JSIConverter<TInner>::toJSI(runtime, value.get());
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSITypeCheckable<TInner>
  {
    return value.isUndefined() || JSIConverter<TInner>::canConvert(runtime, value);
  }
};

} // namespace margelo::nitro
