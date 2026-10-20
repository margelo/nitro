//
// Created by Marc Rousavy on 07.10.24.
//

#pragma once

#include "IsSharedPtrTo.hpp"
#include "NitroDefines.hpp"
#include "NitroTypeInfo.hpp"
#include <jsi/jsi.h>
#include <type_traits>

namespace margelo::nitro {

using namespace facebook;

// jsi::HostObject <> {}
template <typename T>
struct JSIConverter<T, std::enable_if_t<is_shared_ptr_to_v<T, jsi::HostObject>>> final {
  using TPointee = typename T::element_type;

  static inline T fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
#ifdef NITRO_DEBUG
    if (!arg.isObject()) [[unlikely]] {
      if (arg.isUndefined()) [[unlikely]] {
        throw jsi::JSError(runtime, invalidTypeErrorMessage("undefined", "It is undefined!"));
      } else {
        std::string stringRepresentation = arg.toString(runtime).utf8(runtime);
        throw jsi::JSError(runtime, invalidTypeErrorMessage(stringRepresentation, "It is not an object!"));
      }
    }
#endif
    jsi::Object object = arg.asObject(runtime);

#ifdef NITRO_DEBUG
    if (!object.isHostObject<TPointee>(runtime)) [[unlikely]] {
      if (!object.isHostObject(runtime)) [[unlikely]] {
        std::string stringRepresentation = arg.toString(runtime).utf8(runtime);
        throw jsi::JSError(runtime, invalidTypeErrorMessage(stringRepresentation, "It is not a HostObject at all!"));
      } else {
        std::string stringRepresentation = arg.toString(runtime).utf8(runtime);
        throw jsi::JSError(runtime, invalidTypeErrorMessage(stringRepresentation, "It is a different HostObject<T>!"));
      }
    }
#endif
    return object.getHostObject<TPointee>(runtime);
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const T& arg) {
    if (arg == nullptr) [[unlikely]] {
      std::string typeName = TypeInfo::getFriendlyTypename<TPointee>();
      throw jsi::JSError(runtime, "Cannot convert `nullptr` to HostObject<" + typeName + ">!");
    }

    return jsi::Object::createFromHostObject(runtime, arg);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isObject()) {
      jsi::Object object = value.getObject(runtime);
      return object.isHostObject<TPointee>(runtime);
    }
    return false;
  }

private:
  static std::string invalidTypeErrorMessage(const std::string& typeDescription, const std::string& reason) {
    std::string typeName = TypeInfo::getFriendlyTypename<TPointee>();
    return "Cannot convert \"" + typeDescription + "\" to HostObject<" + typeName + ">! " + reason;
  }
};

} // namespace margelo::nitro
