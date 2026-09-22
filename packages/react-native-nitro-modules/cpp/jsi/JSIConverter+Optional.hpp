//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

// Forward declare a few of the common types that might have cyclic includes.
namespace margelo::nitro {
template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include "JSIConverter.hpp"

#include <jsi/jsi.h>
#include <optional>

namespace margelo::nitro {

using namespace facebook;

// std::optional<T> <> T | undefined
template <typename TInner>
struct JSIConverter<std::optional<TInner>> final {
  static inline std::optional<TInner> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    if (arg.isUndefined()) {
      return std::nullopt;
    }
    if (arg.isNull()) {
      if (JSIConverter<TInner>::canConvert(runtime, arg)) {
        return JSIConverter<TInner>::fromJSI(runtime, arg);
      }
      return std::nullopt;
    }
    return JSIConverter<TInner>::fromJSI(runtime, arg);
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::optional<TInner>& arg) {
    if (arg == std::nullopt) {
      return jsi::Value::undefined();
    } else {
      return JSIConverter<TInner>::toJSI(runtime, arg.value());
    }
  }
  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isUndefined() || value.isNull()) {
      return true;
    }
    if (JSIConverter<TInner>::canConvert(runtime, value)) {
      return true;
    }
    return false;
  }
};

} // namespace margelo::nitro
