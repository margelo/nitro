//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

// Forward declare a few of the common types that might have cyclic includes.
namespace margelo::nitro {
template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include <jsi/jsi.h>
#include <type_traits>
#include <variant>

namespace margelo::nitro {

using namespace facebook;

/**
 * The JSIConverter<T> class can convert any type from and to a jsi::Value.
 * It uses templates to statically create fromJSI/toJSI methods, and will throw compile-time errors
 * if a given type is not convertable.
 * Value types, custom types (HybridObject), and even functions with any number of arguments/types are supported.
 * This type can be extended by just creating a new template for JSIConverter in a header.
 */
template <typename T, typename Enable = void>
struct JSIConverter final {
  JSIConverter() = delete;

  /**
   * Converts the given `jsi::Value` to type `T`.
   * By default, this static-asserts.
   */
  static inline T fromJSI(jsi::Runtime&, const jsi::Value&) {
    static_assert(always_false<T>::value, "This type is not supported by the JSIConverter!");
    return T();
  }
  /**
   * Converts `T` to a `jsi::Value`.
   * By default, this static-asserts.
   */
  static inline jsi::Value toJSI(jsi::Runtime&, T) {
    static_assert(always_false<T>::value, "This type is not supported by the JSIConverter!");
    return jsi::Value::undefined();
  }
  /**
   * Returns whether the given `jsi::Value` can be converted to `T`.
   * This involves runtime type-checks.
   * By default, this returns `false`.
   */
  static inline bool canConvert(jsi::Runtime&, const jsi::Value&) {
    return false;
  }

private:
  template <typename>
  struct always_false : std::false_type {};
};

// int <> number
template <>
struct JSIConverter<int> final {
  static inline int fromJSI(jsi::Runtime&, const jsi::Value& arg) {
    return static_cast<int>(arg.asNumber());
  }
  static inline jsi::Value toJSI(jsi::Runtime&, int arg) {
    return jsi::Value(arg);
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value& value) {
    return value.isNumber();
  }
};

// double <> number
template <>
struct JSIConverter<double> final {
  static inline double fromJSI(jsi::Runtime&, const jsi::Value& arg) {
    return arg.asNumber();
  }
  static inline jsi::Value toJSI(jsi::Runtime&, double arg) {
    return jsi::Value(arg);
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value& value) {
    return value.isNumber();
  }
};

// float <> number
template <>
struct JSIConverter<float> final {
  static inline float fromJSI(jsi::Runtime&, const jsi::Value& arg) {
    return static_cast<float>(arg.asNumber());
  }
  static inline jsi::Value toJSI(jsi::Runtime&, float arg) {
    return jsi::Value(static_cast<double>(arg));
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value& value) {
    return value.isNumber();
  }
};

// int64_t <> BigInt
template <>
struct JSIConverter<int64_t> final {
  static inline int64_t fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    return arg.asBigInt(runtime).asInt64(runtime);
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, int64_t arg) {
    return jsi::BigInt::fromInt64(runtime, arg);
  }
  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isBigInt()) {
      jsi::BigInt bigint = value.getBigInt(runtime);
      return bigint.isInt64(runtime);
    }
    return false;
  }
};

// uint64_t <> BigInt
template <>
struct JSIConverter<uint64_t> final {
  static inline uint64_t fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    return arg.asBigInt(runtime).asUint64(runtime);
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, uint64_t arg) {
    return jsi::BigInt::fromUint64(runtime, arg);
  }
  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isBigInt()) {
      jsi::BigInt bigint = value.getBigInt(runtime);
      return bigint.isUint64(runtime);
    }
    return false;
  }
};

// bool <> boolean
template <>
struct JSIConverter<bool> final {
  static inline bool fromJSI(jsi::Runtime&, const jsi::Value& arg) {
    return arg.asBool();
  }
  static inline jsi::Value toJSI(jsi::Runtime&, bool arg) {
    return jsi::Value(arg);
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value& value) {
    return value.isBool();
  }
};

// std::string <> string
template <>
struct JSIConverter<std::string> final {
  static inline std::string fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    return arg.asString(runtime).utf8(runtime);
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::string& arg) {
    return jsi::String::createFromUtf8(runtime, arg);
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value& value) {
    return value.isString();
  }
};

// std::monostate <> void/undefined
template <>
struct JSIConverter<std::monostate> final {
  static inline std::monostate fromJSI(jsi::Runtime&, const jsi::Value&) {
    return std::monostate{};
  }
  static inline jsi::Value toJSI(jsi::Runtime&, std::monostate) {
    return jsi::Value();
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value&) {
    return true;
  }
};

} // namespace margelo::nitro

#include "JSIConverter+AnyMap.hpp"
#include "JSIConverter+ArrayBuffer.hpp"
#include "JSIConverter+Date.hpp"
#include "JSIConverter+Exception.hpp"
#include "JSIConverter+Function.hpp"
#include "JSIConverter+HostObject.hpp"
#include "JSIConverter+NativeState.hpp"
#include "JSIConverter+Null.hpp"
#include "JSIConverter+Optional.hpp"
#include "JSIConverter+Promise.hpp"
#include "JSIConverter+Tuple.hpp"
#include "JSIConverter+UnorderedMap.hpp"
#include "JSIConverter+Variant.hpp"
#include "JSIConverter+Vector.hpp"
