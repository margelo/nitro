//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/NitroTypeInfo.hpp>
#include <jsi/jsi.h>
#include <memory>
#include <variant>

namespace margelo::nitro {

using namespace facebook;

// std::variant<A, B, C> <> A | B | C
template <typename... Types>
struct JSIConverter<std::variant<Types...>> final {
  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires(JSITypeCheckable<Types> && ...)
  {
    // Check each type in `Types...` to make sure we can convert `jsi::Value` to one of those.
    return (JSIConverter<Types>::canConvert(runtime, value) || ...);
  }

  static inline std::variant<Types...> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires((JSIDecodable<Types> && JSITypeCheckable<Types> && std::constructible_from<Types, Types>) && ...)
  {
    return fromJSIRecursive<Types...>(runtime, value);
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::variant<Types...>& variant)
    requires(JSIEncodable<const Types&> && ...)
  {
    return std::visit(
        [&runtime](const auto& val) -> jsi::Value {
          // Try to convert each type
          return JSIConverter<std::decay_t<decltype(val)>>::toJSI(runtime, val);
        },
        variant);
  }

private:
  template <typename First, typename... Rest>
  static inline std::variant<Types...> fromJSIRecursive(jsi::Runtime& runtime, const jsi::Value& value) {
    if (JSIConverter<First>::canConvert(runtime, value)) {
      return JSIConverter<First>::fromJSI(runtime, value);
    }
    if constexpr (sizeof...(Rest) == 0) {
      std::string string = value.toString(runtime).utf8(runtime);
      std::string types = TypeInfo::getFriendlyTypenames<Types...>();
      throw std::runtime_error("Cannot convert \"" + string + "\" to any type in variant<" + types + ">!");
    } else {
      return fromJSIRecursive<Rest...>(runtime, value);
    }
  }
};

} // namespace margelo::nitro
