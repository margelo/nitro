//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

// Forward declare a few of the common types that might have cyclic includes.
namespace margelo::nitro {
struct AnyValue;
class AnyMap;

template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include "JSIConverter+Variant.hpp"
#include "JSIConverter.hpp"

#include "AnyMap.hpp"
#include "JSIHelpers.hpp"
#include "PropNameIDCache.hpp"
#include <jsi/jsi.h>
#include <memory>

namespace margelo::nitro {

using namespace facebook;

// AnyValue <> Record<K, V>
template <>
struct JSIConverter<AnyValue> final {
  static inline AnyValue fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    return JSIConverter<AnyValue::variant>::fromJSI(runtime, arg);
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const AnyValue& value) {
    return JSIConverter<AnyValue::variant>::toJSI(runtime, value);
  }
  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    return JSIConverter<AnyValue::variant>::canConvert(runtime, value);
  }
};

// AnyMap <> Record<K, V>
template <>
struct JSIConverter<std::shared_ptr<AnyMap>> final {
  static inline std::shared_ptr<AnyMap> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    jsi::Object object = arg.asObject(runtime);
    jsi::Array propNames = object.getPropertyNames(runtime);
    size_t size = propNames.size(runtime);
    std::shared_ptr<AnyMap> map = AnyMap::make(size);
    for (size_t i = 0; i < size; i++) {
      std::string jsKey = propNames.getValueAtIndex(runtime, i).getString(runtime).utf8(runtime);
      jsi::Value jsValue = object.getProperty(runtime, PropNameIDCache::get(runtime, jsKey));
      map->setAny(jsKey, JSIConverter<AnyValue>::fromJSI(runtime, jsValue));
    }
    return map;
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, std::shared_ptr<AnyMap> map) {
    jsi::Object object(runtime);
    for (const auto& item : map->getMap()) {
      jsi::String key = jsi::String::createFromUtf8(runtime, item.first);
      jsi::Value value = JSIConverter<AnyValue>::toJSI(runtime, item.second);
      object.setProperty(runtime, std::move(key), std::move(value));
    }
    return object;
  }
  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) {
      return false;
    }
    jsi::Object object = value.getObject(runtime);
    if (!isPlainObject(runtime, object)) {
      return false;
    }

    jsi::Array propNames = object.getPropertyNames(runtime);
    size_t size = propNames.size(runtime);
    for (size_t i = 0; i < size; i++) {
      std::string key = propNames.getValueAtIndex(runtime, i).getString(runtime).utf8(runtime);
      jsi::Value propValue = object.getProperty(runtime, PropNameIDCache::get(runtime, key));
      if (!JSIConverter<AnyValue>::canConvert(runtime, propValue)) {
        return false;
      }
    }
    return true;
  }
};

} // namespace margelo::nitro
