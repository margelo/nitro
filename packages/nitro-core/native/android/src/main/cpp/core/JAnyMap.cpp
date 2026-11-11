//
//  JAnyMap.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#include "JAnyMap.hpp"

namespace margelo::nitro {

using namespace facebook;

jni::local_ref<jni::JArrayClass<jni::JString>> JAnyMap::getAllKeys() {
  auto& map = _map->getMap();
  auto array = jni::JArrayClass<jni::JString>::newArray(map.size());
  size_t index = 0;
  for (const auto& pair : map) {
    auto jKey = jni::make_jstring(pair.first);
    array->setElement(index, *jKey);
    index++;
  }
  return array;
}

jni::local_ref<JAnyArray> JAnyMap::getAnyArray(const std::string& key) {
  const auto& vector = _map->getArray(key);
  auto javaArray = jni::JArrayClass<JAnyValue::javaobject>::newArray(vector.size());
  for (size_t i = 0; i < vector.size(); i++) {
    auto value = JAnyValue::create(vector[i]);
    javaArray->setElement(i, value.get());
  }
  return javaArray;
}

jni::local_ref<JAnyObject> JAnyMap::getAnyObject(const std::string& key) {
  const auto& map = _map->getObject(key);
  auto javaMap = jni::JHashMap<jni::JString, JAnyValue::javaobject>::create(map.size());
  for (const auto& entry : map) {
    auto string = jni::make_jstring(entry.first);
    auto value = JAnyValue::create(entry.second);
    javaMap->put(string, value);
  }
  return javaMap;
}

jni::local_ref<JAnyValue::javaobject> JAnyMap::getAnyValue(const std::string& key) {
  const auto& any = _map->getAny(key);
  return JAnyValue::create(any);
}

void JAnyMap::setAnyArray(const std::string& key, jni::alias_ref<JAnyArray> value) {
  std::vector<AnyValue> vector;
  size_t size = value->size();
  vector.reserve(size);
  for (size_t i = 0; i < size; i++) {
    auto anyValue = value->getElement(i);
    vector.push_back(anyValue->cthis()->getValue());
  }
  _map->setArray(key, vector);
}
void JAnyMap::setAnyObject(const std::string& key, const jni::alias_ref<JAnyObject>& value) {
  std::unordered_map<std::string, AnyValue> map;
  map.reserve(value->size());
  for (const auto& entry : *value) {
    map.emplace(entry.first->toStdString(), entry.second->cthis()->getValue());
  }
  _map->setObject(key, map);
}
void JAnyMap::setAnyValue(const std::string& key, const jni::alias_ref<JAnyValue::javaobject>& value) {
  _map->setAny(key, value->cthis()->getValue());
}

jni::local_ref<jni::JHashMap<jni::JString, jni::JObject>> JAnyMap::toHashMap() {
  const auto& map = _map->getMap();
  auto javaMap = jni::JHashMap<jni::JString, jni::JObject>::create(map.size());
  for (const auto& [key, value] : map) {
    javaMap->put(jni::make_jstring(key), anyValueToJObject(value));
  }
  return javaMap;
}

jni::local_ref<jni::JObject> JAnyMap::anyValueToJObject(const AnyValue& value) {
  if (std::holds_alternative<NullType>(value)) {
    return nullptr;
  } else if (std::holds_alternative<double>(value)) {
    return jni::JDouble::valueOf(std::get<double>(value));
  } else if (std::holds_alternative<bool>(value)) {
    return jni::JBoolean::valueOf(std::get<bool>(value));
  } else if (std::holds_alternative<int64_t>(value)) {
    return jni::JLong::valueOf(std::get<int64_t>(value));
  } else if (std::holds_alternative<std::string>(value)) {
    return jni::make_jstring(std::get<std::string>(value));
  } else if (std::holds_alternative<AnyArray>(value)) {
    return jni::static_ref_cast<jni::JObject>(anyArrayToJList(std::get<AnyArray>(value)));
  } else if (std::holds_alternative<AnyObject>(value)) {
    return jni::static_ref_cast<jni::JObject>(anyObjectToJHashMap(std::get<AnyObject>(value)));
  }
  return nullptr;
}

jni::local_ref<jni::JArrayList<jni::JObject>> JAnyMap::anyArrayToJList(const AnyArray& array) {
  auto jList = jni::JArrayList<jni::JObject>::create(static_cast<int>(array.size()));
  for (const auto& item : array) {
    jList->add(anyValueToJObject(item));
  }
  return jList;
}

jni::local_ref<jni::JHashMap<jni::JString, jni::JObject>> JAnyMap::anyObjectToJHashMap(const AnyObject& object) {
  auto jMap = jni::JHashMap<jni::JString, jni::JObject>::create(object.size());
  for (const auto& [key, val] : object) {
    jMap->put(jni::make_jstring(key), anyValueToJObject(val));
  }
  return jMap;
}

AnyValue JAnyMap::jObjectToAnyValue(jni::alias_ref<jni::JObject> jObject) {
  if (!jObject) {
    return nitro::null;
  }

  // Check for Double
  if (jObject->isInstanceOf(jni::JDouble::javaClassStatic())) {
    auto jDouble = jni::static_ref_cast<jni::JDouble>(jObject);
    return jDouble->doubleValue();
  }

  // Check for Float
  if (jObject->isInstanceOf(jni::JFloat::javaClassStatic())) {
    auto jFloat = jni::static_ref_cast<jni::JFloat>(jObject);
    return static_cast<double>(jFloat->floatValue());
  }

  // Check for Integer
  if (jObject->isInstanceOf(jni::JInteger::javaClassStatic())) {
    auto jInt = jni::static_ref_cast<jni::JInteger>(jObject);
    return static_cast<double>(jInt->intValue());
  }

  // Check for Boolean
  if (jObject->isInstanceOf(jni::JBoolean::javaClassStatic())) {
    auto jBool = jni::static_ref_cast<jni::JBoolean>(jObject);
    return static_cast<bool>(jBool->booleanValue());
  }

  // Check for Long (bigint)
  if (jObject->isInstanceOf(jni::JLong::javaClassStatic())) {
    auto jLong = jni::static_ref_cast<jni::JLong>(jObject);
    return jLong->longValue();
  }

  // Check for String
  if (jObject->isInstanceOf(jni::JString::javaClassStatic())) {
    auto jString = jni::static_ref_cast<jni::JString>(jObject);
    return jString->toStdString();
  }

  // Check for List (array)
  if (jObject->isInstanceOf(jni::JList<jni::JObject>::javaClassStatic())) {
    auto jList = jni::static_ref_cast<jni::JList<jni::JObject>>(jObject);
    return jListToAnyArray(jList);
  }

  // Check for Map (object)
  if (jObject->isInstanceOf(jni::JMap<jni::JString, jni::JObject>::javaClassStatic())) {
    auto jMap = jni::static_ref_cast<jni::JMap<jni::JString, jni::JObject>>(jObject);
    return jHashMapToAnyObject(jMap);
  }

  throw std::runtime_error("Cannot convert JObject to AnyValue - unsupported type!");
}

AnyArray JAnyMap::jListToAnyArray(jni::alias_ref<jni::JList<jni::JObject>> jList) {
  AnyArray array;
  array.reserve(jList->size());
  for (const auto& item : *jList) {
    array.push_back(jObjectToAnyValue(item));
  }
  return array;
}

AnyObject JAnyMap::jHashMapToAnyObject(jni::alias_ref<jni::JMap<jni::JString, jni::JObject>> jMap) {
  AnyObject object;
  object.reserve(jMap->size());
  for (const auto& entry : *jMap) {
    object.emplace(entry.first->toStdString(), jObjectToAnyValue(entry.second));
  }
  return object;
}

jni::local_ref<JAnyMap::javaobject> JAnyMap::fromMap(jni::alias_ref<jclass>, jni::alias_ref<jni::JMap<jni::JString, jni::JObject>> javaMap,
                                                     bool ignoreIncompatible) {
  size_t size = javaMap->size();
  jni::local_ref<JAnyMap::javaobject> anyMap = JAnyMap::create(size);

  auto& map = anyMap->cthis()->_map->getMap();

  // Bulk convert all entries from Java to C++
  for (const auto& entry : *javaMap) {
    try {
      std::string key = entry.first->toStdString();
      AnyValue value = jObjectToAnyValue(entry.second);
      map.emplace(std::move(key), std::move(value));
    } catch (...) {
      if (ignoreIncompatible) {
        // encountered an incompatible key. Ignore it.
      } else {
        // encountered an incompatible key - we now throw!
        throw;
      }
    }
  }

  return anyMap;
}

} // namespace margelo::nitro
