//
//  JAnyMap.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "AnyMap.hpp"
#include "JAnyValue.hpp"
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents an `AnyMap` implemented in Java.
 */
class JAnyMap final : public jni::HybridClass<JAnyMap> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/AnyMap;";

public:
  /**
   * Create a new, empty `AnyMap` from Java.
   */
  static jni::local_ref<JAnyMap::jhybriddata> initHybrid(jni::alias_ref<jhybridobject>) {
    return makeCxxInstance();
  }
  /**
   * Create a new, empty `AnyMap` with the given preallocated size from Java.
   */
  static jni::local_ref<JAnyMap::jhybriddata> initHybridPreallocatedSize(jni::alias_ref<jhybridobject>, jint preallocatedSize) {
    return makeCxxInstance(preallocatedSize);
  }
  /**
   * Create a new `JAnyMap` from an existing `AnyMap`.
   */
  static jni::local_ref<JAnyMap::javaobject> create(const std::shared_ptr<AnyMap>& map) {
    return newObjectCxxArgs(map);
  }
  /**
   * Create a new `JAnyMap` from the given preallocated size.
   */
  static jni::local_ref<JAnyMap::javaobject> create(int preallocatedSize) {
    return newObjectCxxArgs(preallocatedSize);
  }
  /**
   * Create a new empty `JAnyMap`.
   */
  static jni::local_ref<JAnyMap::javaobject> create() {
    return newObjectCxxArgs();
  }

private:
  JAnyMap() {
    _map = AnyMap::make();
  }
  JAnyMap(jint preallocatedSize) {
    _map = AnyMap::make(static_cast<size_t>(preallocatedSize));
  }
  explicit JAnyMap(const std::shared_ptr<AnyMap>& map) : _map(map) {}

protected:
  bool contains(const std::string& key) {
    return _map->contains(key);
  }
  void remove(const std::string& key) {
    _map->remove(key);
  }
  void clear() {
    _map->clear();
  }
  jni::local_ref<jni::JArrayClass<jni::JString>> getAllKeys();

protected:
  bool isNull(const std::string& key) {
    return _map->isNull(key);
  }
  bool isDouble(const std::string& key) {
    return _map->isDouble(key);
  }
  bool isBoolean(const std::string& key) {
    return _map->isBoolean(key);
  }
  bool isInt64(const std::string& key) {
    return _map->isInt64(key);
  }
  bool isString(const std::string& key) {
    return _map->isString(key);
  }
  bool isArray(const std::string& key) {
    return _map->isArray(key);
  }
  bool isObject(const std::string& key) {
    return _map->isObject(key);
  }

protected:
  double getDouble(const std::string& key) {
    return _map->getDouble(key);
  }
  bool getBoolean(const std::string& key) {
    return _map->getBoolean(key);
  }
  int64_t getInt64(const std::string& key) {
    return _map->getInt64(key);
  }
  std::string getString(const std::string& key) {
    return _map->getString(key);
  }
  jni::local_ref<JAnyArray> getAnyArray(const std::string& key);
  jni::local_ref<JAnyObject> getAnyObject(const std::string& key);
  jni::local_ref<JAnyValue::javaobject> getAnyValue(const std::string& key);

protected:
  void setNull(const std::string& key) {
    _map->setNull(key);
  }
  void setDouble(const std::string& key, double value) {
    _map->setDouble(key, value);
  }
  void setBoolean(const std::string& key, bool value) {
    _map->setBoolean(key, value);
  }
  void setInt64(const std::string& key, int64_t value) {
    _map->setInt64(key, value);
  }
  void setString(const std::string& key, const std::string& value) {
    _map->setString(key, value);
  }
  void setAnyArray(const std::string& key, jni::alias_ref<JAnyArray> value);
  void setAnyObject(const std::string& key, const jni::alias_ref<JAnyObject>& value);
  void setAnyValue(const std::string& key, const jni::alias_ref<JAnyValue::javaobject>& value);

protected:
  void merge(jni::alias_ref<JAnyMap::javaobject> other) {
    _map->merge(other->cthis()->_map);
  }

  /**
   * Bulk-converts the entire `JAnyMap` to a Java `HashMap<String, Object>` in a single JNI call.
   */
  jni::local_ref<jni::JHashMap<jni::JString, jni::JObject>> toHashMap();

  /**
   * Bulk-converts a Java `Map<String, Object>` into this `JAnyMap` in a single JNI call.
   *
   * When `ignoreIncompatible` is `true`, this will drop keys that can't be converted.
   * When `ignoreIncompatible` is `false`, this will throw when a key cannot be converted.
   */
  static jni::local_ref<JAnyMap::javaobject> fromMap(jni::alias_ref<jclass>, jni::alias_ref<jni::JMap<jni::JString, jni::JObject>> javaMap,
                                                     bool ignoreIncompatible);

private:
  static jni::local_ref<jni::JObject> anyValueToJObject(const AnyValue& value);
  static jni::local_ref<jni::JArrayList<jni::JObject>> anyArrayToJList(const AnyArray& array);
  static jni::local_ref<jni::JHashMap<jni::JString, jni::JObject>> anyObjectToJHashMap(const AnyObject& object);

  static AnyValue jObjectToAnyValue(jni::alias_ref<jni::JObject> jObject);
  static AnyArray jListToAnyArray(jni::alias_ref<jni::JList<jni::JObject>> jList);
  static AnyObject jHashMapToAnyObject(jni::alias_ref<jni::JMap<jni::JString, jni::JObject>> jMap);

public:
  [[nodiscard]]
  std::shared_ptr<AnyMap> getMap() const {
    return _map;
  }

private:
  friend HybridBase;
  using HybridBase::HybridBase;
  std::shared_ptr<AnyMap> _map;

public:
  static void registerNatives() {
    registerHybrid({
        // init
        makeNativeMethod("initHybrid", JAnyMap::initHybrid),
        makeNativeMethod("initHybrid", JAnyMap::initHybridPreallocatedSize),
        // helpers
        makeNativeMethod("contains", JAnyMap::contains),
        makeNativeMethod("remove", JAnyMap::remove),
        makeNativeMethod("clear", JAnyMap::clear),
        makeNativeMethod("getAllKeys", JAnyMap::getAllKeys),
        // is
        makeNativeMethod("isNull", JAnyMap::isNull),
        makeNativeMethod("isDouble", JAnyMap::isDouble),
        makeNativeMethod("isBoolean", JAnyMap::isBoolean),
        makeNativeMethod("isInt64", JAnyMap::isInt64),
        makeNativeMethod("isString", JAnyMap::isString),
        makeNativeMethod("isArray", JAnyMap::isArray),
        makeNativeMethod("isObject", JAnyMap::isObject),
        // get
        makeNativeMethod("getDouble", JAnyMap::getDouble),
        makeNativeMethod("getBoolean", JAnyMap::getBoolean),
        makeNativeMethod("getInt64", JAnyMap::getInt64),
        makeNativeMethod("getString", JAnyMap::getString),
        makeNativeMethod("getAnyArray", JAnyMap::getAnyArray),
        makeNativeMethod("getAnyObject", JAnyMap::getAnyObject),
        makeNativeMethod("getAnyValue", JAnyMap::getAnyValue),
        // set
        makeNativeMethod("setNull", JAnyMap::setNull),
        makeNativeMethod("setDouble", JAnyMap::setDouble),
        makeNativeMethod("setBoolean", JAnyMap::setBoolean),
        makeNativeMethod("setInt64", JAnyMap::setInt64),
        makeNativeMethod("setString", JAnyMap::setString),
        makeNativeMethod("setAnyArray", JAnyMap::setAnyArray),
        makeNativeMethod("setAnyObject", JAnyMap::setAnyObject),
        makeNativeMethod("setAnyValue", JAnyMap::setAnyValue),
        // merge
        makeNativeMethod("merge", JAnyMap::merge),
        // bulk conversion
        makeNativeMethod("toHashMap", JAnyMap::toHashMap),
        makeNativeMethod("fromMap", JAnyMap::fromMap),
    });
  }
};

} // namespace margelo::nitro
