//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <concepts>
#include <jsi/jsi.h>
#include <type_traits>
#include <utility>
#include <variant>

namespace margelo::nitro {

using namespace facebook;

/**
 * Specialize JSIConverter<T> to provide fromJSI, toJSI, and optional canConvert operations.
 * Unsupported types expose no operations so the conversion concepts evaluate to false.
 */
template <typename T>
struct JSIConverter final {
  JSIConverter() = delete;
};

/** Requires conversion from a JSI value to T. */
template <typename T>
concept JSIDecodable = requires(jsi::Runtime& runtime, const jsi::Value& value) {
  { JSIConverter<T>::fromJSI(runtime, value) } -> std::same_as<T>;
};

/**
 * Requires conversion to a JSI value with T's value category preserved.
 * Use JSIEncodable<T> for an rvalue and JSIEncodable<const T&> for a const lvalue.
 */
template <typename T>
concept JSIEncodable = requires(jsi::Runtime& runtime, T&& value) {
  { JSIConverter<std::remove_cvref_t<T>>::toJSI(runtime, std::forward<T>(value)) } -> std::convertible_to<jsi::Value>;
};

/** Requires both decoding T and encoding an rvalue of T. */
template <typename T>
concept JSIConvertible = JSIDecodable<T> && JSIEncodable<T>;

// Runtime type checks are needed for union selection, but are optional for direct decoding.
template <typename T>
concept JSITypeCheckable = requires(jsi::Runtime& runtime, const jsi::Value& value) {
  { JSIConverter<T>::canConvert(runtime, value) } -> std::same_as<bool>;
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

// Extension headers include this header before their declarations so their constraints can use these concepts.
#include <NitroModules/JSIConverter+AnyJSON.hpp>
#include <NitroModules/JSIConverter+ArrayBuffer.hpp>
#include <NitroModules/JSIConverter+Callback.hpp>
#include <NitroModules/JSIConverter+Exception.hpp>
#include <NitroModules/JSIConverter+Function.hpp>
#include <NitroModules/JSIConverter+HostObject.hpp>
#include <NitroModules/JSIConverter+NativeState.hpp>
#include <NitroModules/JSIConverter+Null.hpp>
#include <NitroModules/JSIConverter+Optional.hpp>
#include <NitroModules/JSIConverter+Promise.hpp>
#include <NitroModules/JSIConverter+Tuple.hpp>
#include <NitroModules/JSIConverter+UnorderedMap.hpp>
#include <NitroModules/JSIConverter+Variant.hpp>
#include <NitroModules/JSIConverter+Vector.hpp>
