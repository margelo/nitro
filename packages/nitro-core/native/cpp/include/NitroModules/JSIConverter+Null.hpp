//
// Created by Marc Rousavy on 10.11.25.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/Null.hpp>
#include <jsi/jsi.h>

namespace margelo::nitro {

using namespace facebook;

// NullType <> null
template <>
struct JSIConverter<NullType> final {
  static inline NullType fromJSI(jsi::Runtime&, const jsi::Value& arg) {
    if (!arg.isNull()) [[unlikely]] {
      throw std::runtime_error("Cannot convert non-null value to NullType!");
    }
    return nitro::null;
  }
  static inline jsi::Value toJSI(jsi::Runtime&, const NullType&) {
    return jsi::Value::null();
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value& value) {
    return value.isNull();
  }
};

} // namespace margelo::nitro
