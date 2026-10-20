#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/JSIHelpers.hpp>
#include <concepts>

namespace margelo::nitro {

// Dictionary's Hashable constraint is not exported to C++. Nitrogen supplies a
// concrete Swift facade; all iteration and JSI conversion stays here.
template <typename Dictionary, typename Key, typename Value>
  requires requires(Dictionary& dictionary, const Dictionary& constDictionary, swift::Int size, const Key& key, const Value& value,
                    swift::Optional<Key>& cursorKey, swift::Optional<Value>& cursorValue) {
    { Dictionary::init(size) } -> std::same_as<Dictionary>;
    { dictionary.set(key, value) } -> std::same_as<void>;
    { constDictionary.makeCursor().next(cursorKey, cursorValue) } -> std::same_as<bool>;
  }
struct SwiftDictionaryJSIConverter {
  static Dictionary fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    auto object = value.asObject(runtime);
    auto keys = object.getPropertyNames(runtime);
    const auto size = keys.size(runtime);
    auto dictionary = Dictionary::init(static_cast<swift::Int>(size));
    for (size_t i = 0; i < size; ++i) {
      auto key = keys.getValueAtIndex(runtime, i);
      auto entry = object.getProperty(runtime, key);
      dictionary.set(JSIConverter<Key>::fromJSI(runtime, key), JSIConverter<Value>::fromJSI(runtime, entry));
    }
    return dictionary;
  }

  static jsi::Value toJSI(jsi::Runtime& runtime, const Dictionary& dictionary) {
    jsi::Object object(runtime);
    auto cursor = dictionary.makeCursor();
    auto swiftKey = swift::Optional<Key>::none();
    auto swiftValue = swift::Optional<Value>::none();
    while (cursor.next(swiftKey, swiftValue)) {
      auto key = JSIConverter<Key>::toJSI(runtime, swiftKey.get());
      auto value = JSIConverter<Value>::toJSI(runtime, swiftValue.get());
      object.setProperty(runtime, key, std::move(value));
    }
    return object;
  }

  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) {
      return false;
    }
    auto object = value.getObject(runtime);
    if (!isPlainObject(runtime, object)) {
      return false;
    }
    auto keys = object.getPropertyNames(runtime);
    if (keys.size(runtime) == 0) {
      return true;
    }
    auto key = keys.getValueAtIndex(runtime, 0);
    return JSIConverter<Key>::canConvert(runtime, key) && JSIConverter<Value>::canConvert(runtime, object.getProperty(runtime, key));
  }
};

} // namespace margelo::nitro
