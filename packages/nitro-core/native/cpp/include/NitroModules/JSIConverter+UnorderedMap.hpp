//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/JSIHelpers.hpp>
#include <NitroModules/PropNameIDCache.hpp>
#include <jsi/jsi.h>
#include <unordered_map>

namespace margelo::nitro {

using namespace facebook;

// std::unordered_map<std::string, T> <> Record<string, T>
template <typename ValueType>
struct JSIConverter<std::unordered_map<std::string, ValueType>> final {
  static inline std::unordered_map<std::string, ValueType> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg)
    requires(JSIDecodable<ValueType> && std::constructible_from<ValueType, ValueType>)
  {
    jsi::Object object = arg.asObject(runtime);
    jsi::Array propertyNames = object.getPropertyNames(runtime);
    size_t length = propertyNames.size(runtime);

    std::unordered_map<std::string, ValueType> map;
    map.reserve(length);
    for (size_t i = 0; i < length; ++i) {
      std::string key = propertyNames.getValueAtIndex(runtime, i).asString(runtime).utf8(runtime);
      jsi::Value value = object.getProperty(runtime, PropNameIDCache::get(runtime, key));
      map.emplace(key, JSIConverter<ValueType>::fromJSI(runtime, value));
    }
    return map;
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::unordered_map<std::string, ValueType>& map)
    requires JSIEncodable<const ValueType&>
  {
    jsi::Object object(runtime);
    for (const auto& [key, value] : map) {
      jsi::Value jsValue = JSIConverter<std::remove_cvref_t<ValueType>>::toJSI(runtime, value);
      object.setProperty(runtime, PropNameIDCache::get(runtime, key), std::move(jsValue));
    }
    return object;
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSITypeCheckable<ValueType>
  {
    if (!value.isObject()) {
      return false;
    }
    jsi::Object object = value.getObject(runtime);
    if (!isPlainObject(runtime, object)) {
      return false;
    }

    jsi::Array propNames = object.getPropertyNames(runtime);
    if (propNames.size(runtime) == 0) {
      return true;
    }
    jsi::Value firstKey = propNames.getValueAtIndex(runtime, 0);
    jsi::Value firstValue = object.getProperty(runtime, firstKey);
    return JSIConverter<ValueType>::canConvert(runtime, firstValue);
  }
};

} // namespace margelo::nitro
