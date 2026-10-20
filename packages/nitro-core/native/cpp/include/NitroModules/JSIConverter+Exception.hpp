//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/CommonGlobals.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/NitroTypeInfo.hpp>
#include <NitroModules/PropNameIDCache.hpp>
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
      return runtime.createError(jsi::String::createFromUtf8(runtime, e.what()));
    } catch (...) {
      // Some unknown exception was thrown - maybe an Objective-C error?
      std::string errorName = TypeInfo::getCurrentExceptionName();
      return runtime.createError(jsi::String::createFromUtf8(runtime, "Unknown " + errorName + " error."));
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
