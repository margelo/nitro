//
// Created by Marc Rousavy on 16.10.25.
//

#pragma once

namespace margelo::nitro {
class HybridObject;
} // namespace margelo::nitro

#include "IsSharedPtrTo.hpp"
#include "NitroDefines.hpp"
#include "NitroTypeInfo.hpp"
#include <jsi/jsi.h>
#include <type_traits>

namespace margelo::nitro {

using namespace facebook;

// NativeState <> {}
template <typename T>
struct JSIConverter<T, std::enable_if_t<is_shared_ptr_to_v<T, jsi::NativeState>>> final {
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
    if (!object.hasNativeState(runtime)) [[unlikely]] {
      std::string stringRepresentation = arg.toString(runtime).utf8(runtime);
      throw jsi::JSError(runtime, invalidTypeErrorMessage(stringRepresentation, "It does not have a NativeState!"));
    }
#endif

    std::shared_ptr<jsi::NativeState> nativeState = object.getNativeState(runtime);
    std::shared_ptr<TPointee> result = std::dynamic_pointer_cast<TPointee>(nativeState);
    if (result == nullptr) [[unlikely]] {
      std::string stringRepresentation = arg.toString(runtime).utf8(runtime);
      std::string typeName = TypeInfo::getFriendlyTypename<TPointee>();
      throw jsi::JSError(runtime, invalidTypeErrorMessage(stringRepresentation, "Downcasting failed - It has a different NativeState<T>!\n"
                                                                                "- Did you accidentally pass a different type?\n"
                                                                                "- Is react-native-nitro-modules linked multiple times? "
                                                                                "Ensure you don't have any duplicate symbols for `" +
                                                                                    typeName + "` in your app's binary."));
    }

    return result;
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const T& arg) {
    if (arg == nullptr) [[unlikely]] {
      std::string typeName = TypeInfo::getFriendlyTypename<TPointee>();
      throw jsi::JSError(runtime, "Cannot convert `nullptr` to NativeState<" + typeName + ">!");
    }

    if constexpr (std::is_base_of_v<HybridObject, TPointee>) {
      // It's a HybridObject - use its internal constructor which caches jsi::Objects for proper memory management!
      return arg->toObject(runtime);
    } else {
      // It's any other kind of jsi::NativeState - just create it as normal. This will not have a prototype then!
      jsi::Object object(runtime);
      object.setNativeState(runtime, arg);
      return object;
    }
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isObject()) {
      jsi::Object object = value.getObject(runtime);
      return object.hasNativeState<TPointee>(runtime);
    }
    return false;
  }

private:
  static std::string invalidTypeErrorMessage(const std::string& typeDescription, const std::string& reason) {
    std::string typeName = TypeInfo::getFriendlyTypename<TPointee>();
    return "Cannot convert \"" + typeDescription + "\" to NativeState<" + typeName + ">! " + reason;
  }
};

} // namespace margelo::nitro
