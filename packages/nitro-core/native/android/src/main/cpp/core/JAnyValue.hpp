//
//  JAnyMap.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "AnyMap.hpp"
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents an `AnyValue` (variant) implemented in Java.
 */
class JAnyValue final : public jni::HybridClass<JAnyValue> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/AnyValue;";

  /**
   * Represents an `Array<AnyValue>`
   */
  using JAnyArray = jni::JArrayClass<JAnyValue::javaobject>;
  /**
   * Represents a `Map<String, AnyValue>`
   */
  using JAnyObject = jni::JMap<jni::JString, JAnyValue::javaobject>;

public:
  /**
   * Create a new `JAnyValue` from an existing `AnyValue`.
   */
  static jni::local_ref<JAnyValue::javaobject> create(AnyValue&& value) {
    return newObjectCxxArgs(std::move(value));
  }
  static jni::local_ref<JAnyValue::javaobject> create(const AnyValue& value) {
    return newObjectCxxArgs(value);
  }

protected:
  static jni::local_ref<JAnyValue::jhybriddata> initHybridNull(jni::alias_ref<jhybridobject>) {
    return makeCxxInstance(/* null */);
  }
  static jni::local_ref<JAnyValue::jhybriddata> initHybridDouble(jni::alias_ref<jhybridobject>, double value) {
    return makeCxxInstance(value);
  }
  static jni::local_ref<JAnyValue::jhybriddata> initHybridBoolean(jni::alias_ref<jhybridobject>, bool value) {
    return makeCxxInstance(value);
  }
  static jni::local_ref<JAnyValue::jhybriddata> initHybridLong(jni::alias_ref<jhybridobject>, int64_t value) {
    return makeCxxInstance(value);
  }
  static jni::local_ref<JAnyValue::jhybriddata> initHybridString(jni::alias_ref<jhybridobject>, const std::string& value) {
    return makeCxxInstance(value);
  }
  static jni::local_ref<JAnyValue::jhybriddata> initHybridAnyArray(jni::alias_ref<jhybridobject>, jni::alias_ref<JAnyArray> value) {
    std::vector<AnyValue> vector;
    size_t size = value->size();
    vector.reserve(size);
    for (size_t i = 0; i < size; i++) {
      auto anyValue = value->getElement(i);
      vector.push_back(anyValue->cthis()->getValue());
    }
    return makeCxxInstance(std::move(vector));
  }
  static jni::local_ref<JAnyValue::jhybriddata> initHybridAnyObject(jni::alias_ref<jhybridobject>, jni::alias_ref<JAnyObject> value) {
    std::unordered_map<std::string, AnyValue> map;
    map.reserve(value->size());
    for (const auto& entry : *value) {
      map.emplace(entry.first->toStdString(), entry.second->cthis()->getValue());
    }
    return makeCxxInstance(std::move(map));
  }

private:
  // Java initializers
  explicit JAnyValue(NullType null) : _value(null) {}
  explicit JAnyValue(double value) : _value(value) {}
  explicit JAnyValue(bool value) : _value(value) {}
  explicit JAnyValue(int64_t value) : _value(value) {}
  explicit JAnyValue(const std::string& value) : _value(value) {}
  explicit JAnyValue(AnyArray&& value) : _value(std::move(value)) {}
  explicit JAnyValue(AnyObject&& value) : _value(std::move(value)) {}
  // C++ initializers
  explicit JAnyValue(const AnyValue& value) : _value(value) {}
  explicit JAnyValue(AnyValue&& value) : _value(std::move(value)) {}

protected:
  bool isNull() {
    return std::holds_alternative<NullType>(_value);
  }
  bool isDouble() {
    return std::holds_alternative<double>(_value);
  }
  bool isBoolean() {
    return std::holds_alternative<bool>(_value);
  }
  bool isInt64() {
    return std::holds_alternative<int64_t>(_value);
  }
  bool isString() {
    return std::holds_alternative<std::string>(_value);
  }
  bool isAnyArray() {
    return std::holds_alternative<AnyArray>(_value);
  }
  bool isAnyObject() {
    return std::holds_alternative<AnyObject>(_value);
  }

protected:
  double asDouble() {
    return std::get<double>(_value);
  }
  bool asBoolean() {
    return std::get<bool>(_value);
  }
  int64_t asInt64() {
    return std::get<int64_t>(_value);
  }
  std::string asString() {
    return std::get<std::string>(_value);
  }
  jni::local_ref<JAnyArray> asAnyArray() {
    auto vector = std::get<AnyArray>(_value);
    auto javaArray = jni::JArrayClass<JAnyValue::javaobject>::newArray(vector.size());
    for (size_t i = 0; i < vector.size(); i++) {
      auto value = JAnyValue::create(vector[i]);
      javaArray->setElement(i, value.get());
    }
    return javaArray;
  }
  jni::local_ref<JAnyObject> asAnyObject() {
    auto map = std::get<AnyObject>(_value);
    auto javaMap = jni::JHashMap<jni::JString, JAnyValue::javaobject>::create(map.size());
    for (const auto& entry : map) {
      auto key = jni::make_jstring(entry.first);
      auto value = JAnyValue::create(entry.second);
      javaMap->put(key, value);
    }
    return javaMap;
  }

public:
  [[nodiscard]] const AnyValue& getValue() const noexcept {
    return _value;
  }

private:
  friend HybridBase;
  using HybridBase::HybridBase;
  AnyValue _value;

public:
  static void registerNatives() {
    registerHybrid({
        // init
        makeNativeMethod("initHybrid", JAnyValue::initHybridNull),
        makeNativeMethod("initHybrid", JAnyValue::initHybridDouble),
        makeNativeMethod("initHybrid", JAnyValue::initHybridBoolean),
        makeNativeMethod("initHybrid", JAnyValue::initHybridLong),
        makeNativeMethod("initHybrid", JAnyValue::initHybridString),
        makeNativeMethod("initHybrid", JAnyValue::initHybridAnyArray),
        makeNativeMethod("initHybrid", JAnyValue::initHybridAnyObject),
        // is
        makeNativeMethod("isNull", JAnyValue::isNull),
        makeNativeMethod("isDouble", JAnyValue::isDouble),
        makeNativeMethod("isBoolean", JAnyValue::isBoolean),
        makeNativeMethod("isInt64", JAnyValue::isInt64),
        makeNativeMethod("isString", JAnyValue::isString),
        makeNativeMethod("isAnyArray", JAnyValue::isAnyArray),
        makeNativeMethod("isAnyObject", JAnyValue::isAnyObject),
        // get
        makeNativeMethod("asDouble", JAnyValue::asDouble),
        makeNativeMethod("asBoolean", JAnyValue::asBoolean),
        makeNativeMethod("asInt64", JAnyValue::asInt64),
        makeNativeMethod("asString", JAnyValue::asString),
        makeNativeMethod("asAnyArray", JAnyValue::asAnyArray),
        makeNativeMethod("asAnyObject", JAnyValue::asAnyObject),
    });
  }
};

using JAnyArray = JAnyValue::JAnyArray;
using JAnyObject = JAnyValue::JAnyObject;

} // namespace margelo::nitro
