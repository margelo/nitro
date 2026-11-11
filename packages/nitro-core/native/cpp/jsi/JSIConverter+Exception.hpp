//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

// Forward declare a few of the common types that might have cyclic includes.
namespace margelo::nitro {
template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include "CommonGlobals.hpp"
#include "JSIConverter.hpp"
#include "NitroTypeInfo.hpp"
#include "PropNameIDCache.hpp"
#include <exception>
#include <jsi/jsi.h>

namespace margelo::nitro {

using namespace facebook;

// std::exception_ptr <> Error
template <>
struct JSIConverter<std::exception_ptr> final {
  static inline std::exception_ptr fromJSI(jsi::Runtime& runtime, const jsi::Value& error) {
    jsi::Object object = error.asObject(runtime);
    std::string name = object.getProperty(runtime, PropNameIDCache::get(runtime, "name")).asString(runtime).utf8(runtime);
    std::string message = object.getProperty(runtime, PropNameIDCache::get(runtime, "message")).asString(runtime).utf8(runtime);
    return std::make_exception_ptr(std::runtime_error(name + ": " + message));
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::exception_ptr& exception) {
    if (exception == nullptr) [[unlikely]] {
      throw std::runtime_error("Cannot convert a nullptr exception_ptr to a JS Error!");
    }

    try {
      std::rethrow_exception(exception);
    } catch (const std::exception& e) {
      jsi::JSError error(runtime, e.what());
      return jsi::Value(runtime, error.value());
    } catch (...) {
      // Some unknown exception was thrown - maybe an Objective-C error?
      std::string errorName = TypeInfo::getCurrentExceptionName();
      jsi::JSError error(runtime, "Unknown " + errorName + " error.");
      return jsi::Value(runtime, error.value());
    }
  }
  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) {
      return false;
    }
    jsi::Object object = value.getObject(runtime);
    return CommonGlobals::Error::isInstanceOf(runtime, object);
  }
};

} // namespace margelo::nitro
