//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/AnyJSON.hpp>
#include <NitroModules/CommonGlobals.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/JSIHelpers.hpp>
#include <NitroModules/PropNameIDCache.hpp>
#include <jsi/jsi.h>
#include <memory>

namespace margelo::nitro {

using namespace facebook;

// JSON <> unknown
template <>
struct JSIConverter<AnyJSON> final {
  static AnyJSON fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    jsi::String string = CommonGlobals::JSON::stringify(runtime, arg);
    return AnyJSON(string.utf8(runtime));
  }
  static jsi::Value toJSI(jsi::Runtime& runtime, const AnyJSON& value) {
    const std::string& string = value.stringRepresentation;
    return jsi::Value::createFromJsonUtf8(runtime, reinterpret_cast<const uint8_t*>(string.data()), string.length());
  }
  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    return value.isNull() || value.isBool() || value.isNumber() || value.isString() ||
           (value.isObject() && !value.getObject(runtime).isFunction(runtime));
  }
};

} // namespace margelo::nitro
