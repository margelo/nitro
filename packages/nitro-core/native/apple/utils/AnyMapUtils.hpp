//
//  AnyMapUtils.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 20.08.24.
//

#pragma once

#include "AnyMap.hpp"

namespace margelo::nitro {

using SharedAnyMap = std::shared_ptr<AnyMap>;

namespace AnyMapUtils {

  inline AnyValue create_AnyValue(NullType null) {
    return AnyValue{null};
  }
  inline AnyValue create_AnyValue(bool boolValue) {
    return AnyValue{boolValue};
  }
  inline AnyValue create_AnyValue(double doubleValue) {
    return AnyValue{doubleValue};
  }
  inline AnyValue create_AnyValue(int64_t int64Value) {
    return AnyValue{int64Value};
  }
  inline AnyValue create_AnyValue(const std::string& stringValue) {
    return AnyValue{stringValue};
  }
  inline AnyValue create_AnyValue(const AnyArray& arrayValue) {
    return AnyValue{arrayValue};
  }
  inline AnyValue create_AnyValue(const AnyObject& objectValue) {
    return AnyValue{objectValue};
  }

  inline bool is_AnyValue_null(const AnyValue& value) {
    return std::holds_alternative<NullType>(value);
  }
  inline bool is_AnyValue_bool(const AnyValue& value) {
    return std::holds_alternative<bool>(value);
  }
  inline bool is_AnyValue_number(const AnyValue& value) {
    return std::holds_alternative<double>(value);
  }
  inline bool is_AnyValue_int64(const AnyValue& value) {
    return std::holds_alternative<int64_t>(value);
  }
  inline bool is_AnyValue_string(const AnyValue& value) {
    return std::holds_alternative<std::string>(value);
  }
  inline bool is_AnyValue_AnyArray(const AnyValue& value) {
    return std::holds_alternative<AnyArray>(value);
  }
  inline bool is_AnyValue_AnyObject(const AnyValue& value) {
    return std::holds_alternative<AnyObject>(value);
  }

  inline NullType get_AnyValue_null(const AnyValue& value) {
    return std::get<NullType>(value);
  }
  inline bool get_AnyValue_bool(const AnyValue& value) {
    return std::get<bool>(value);
  }
  inline double get_AnyValue_number(const AnyValue& value) {
    return std::get<double>(value);
  }
  inline int64_t get_AnyValue_int64(const AnyValue& value) {
    return std::get<int64_t>(value);
  }
  inline std::string get_AnyValue_string(const AnyValue& value) {
    return std::get<std::string>(value);
  }
  inline AnyArray get_AnyValue_AnyArray(const AnyValue& value) {
    return std::get<AnyArray>(value);
  }
  inline AnyObject get_AnyValue_AnyObject(const AnyValue& value) {
    return std::get<AnyObject>(value);
  }

  inline std::vector<std::string> getAnyObjectKeys(const AnyObject& object) {
    std::vector<std::string> keys;
    keys.reserve(object.size());
    for (const auto& entry : object) {
      keys.push_back(entry.first);
    }
    return keys;
  }

  inline AnyValue getAnyObjectValue(const AnyObject& object, const std::string& key) {
    auto item = object.find(key);
    if (item == object.end()) {
      throw std::runtime_error("Couldn't find " + key + " in AnyObject!");
    }
    return item->second;
  }

}; // namespace AnyMapUtils

} // namespace margelo::nitro
