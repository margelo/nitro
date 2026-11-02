#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <fbjni/fbjni.h>
#include <stdexcept>
#include <tuple>

namespace margelo::nitro {

namespace jni = facebook::jni;
namespace jsi = facebook::jsi;

template <typename JavaVariant>
  requires requires { typename JavaVariant::Cases; }
struct JSIConverter<jni::local_ref<JavaVariant>> final {
  static jni::local_ref<JavaVariant> fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    return decode<0>(runtime, value);
  }

  static jsi::Value toJSI(jsi::Runtime& runtime, jni::alias_ref<JavaVariant> value) {
    return encode<0>(runtime, value, value->getIndex());
  }

  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    return canConvertCase(runtime, value, std::make_index_sequence<std::tuple_size_v<typename JavaVariant::Cases>>{});
  }

private:
  template <size_t Index>
  using Case = std::tuple_element_t<Index, typename JavaVariant::Cases>;

  template <size_t Index>
  static jni::local_ref<JavaVariant> decode(jsi::Runtime& runtime, const jsi::Value& value) {
    if constexpr (Index == std::tuple_size_v<typename JavaVariant::Cases>) {
      throw std::runtime_error("Cannot convert \"" + value.toString(runtime).utf8(runtime) + "\" to any type in " +
                               JavaVariant::diagnosticName + "!");
    } else {
      using Value = typename Case<Index>::Value;
      if constexpr (JSIPreparable<Value>) {
        auto prepared = JSIConverter<Value>::prepareFromJSI(runtime, value);
        if (prepared) {
          return Case<Index>::create(JSIConverter<Value>::fromPreparedJSI(runtime, std::move(*prepared)));
        }
      } else {
        if (JSIConverter<Value>::canConvert(runtime, value)) {
          return Case<Index>::create(JSIConverter<Value>::fromJSI(runtime, value));
        }
      }
      return decode<Index + 1>(runtime, value);
    }
  }

  template <size_t Index>
  static jsi::Value encode(jsi::Runtime& runtime, jni::alias_ref<JavaVariant> value, size_t index) {
    if constexpr (Index == std::tuple_size_v<typename JavaVariant::Cases>) {
      throw std::invalid_argument("Invalid Kotlin variant index.");
    } else {
      if (index == Index) {
        auto payload = jni::static_ref_cast<Case<Index>>(value)->getValue();
        return JSIConverter<typename Case<Index>::Value>::toJSI(runtime, std::move(payload));
      }
      return encode<Index + 1>(runtime, value, index);
    }
  }

  template <size_t... Index>
  static bool canConvertCase(jsi::Runtime& runtime, const jsi::Value& value, std::index_sequence<Index...>) {
    return (JSIConverter<typename Case<Index>::Value>::canConvert(runtime, value) || ...);
  }
};

} // namespace margelo::nitro
