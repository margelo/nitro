//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/Callback.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/detail/PromiseType.hpp>
#include <NitroModules/PropNameIDCache.hpp>
#include <functional>
#include <jsi/jsi.h>
#include <string>
#include <type_traits>
#include <utility>

namespace margelo::nitro {

using namespace facebook;

// [](Args...) -> T {} <> (Args...) => T
template <typename R, typename... Args>
struct JSIConverter<std::function<R(Args...)>> final {
  // Decoded void and Promise-returning JS functions are dispatched asynchronously.
  inline static constexpr bool isAsync = detail::is_promise_v<R> || std::is_void_v<R>;
  // Promise<T> -> T
  using ActualR = std::conditional_t<isAsync, detail::promise_type_v<R>, R>;

  static inline std::function<R(Args...)> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg)
    requires((JSIEncodable<Args> && ...) && (std::is_void_v<ActualR> || JSIDecodable<ActualR>))
  {
    // TODO: Avoid escaping here for a proper local implementation
    auto callback = JSIConverter<Callback<ActualR(Args...)>>::fromJSI(runtime, arg);
    return [callback = std::move(callback)](Args&&... args) -> auto {
      if constexpr (std::is_void_v<R>) {
        callback.callAndForget(std::forward<Args>(args)...);
      } else if constexpr (isAsync) {
        return callback.callAsync(std::forward<Args>(args)...);
      } else {
        return callback.callSync(std::forward<Args>(args)...);
      }
    };
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, std::function<R(Args...)>&& function,
                                 const std::string& functionName = "hostFunction")
    requires((JSIDecodable<std::decay_t<Args>> && ...) && (std::is_void_v<R> || JSIEncodable<R>))
  {
    jsi::HostFunctionType jsFunction = [function = std::move(function)](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args,
                                                                        size_t count) -> jsi::Value {
      if (count != sizeof...(Args)) [[unlikely]] {
        throw jsi::JSError(runtime, "Function expected " + std::to_string(sizeof...(Args)) + " arguments, but received " +
                                        std::to_string(count) + "!");
      }
      return callFunction(runtime, function, args, std::index_sequence_for<Args...>{});
    };
    return jsi::Function::createFromHostFunction(runtime, PropNameIDCache::get(runtime, functionName), sizeof...(Args),
                                                 std::move(jsFunction));
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::function<R(Args...)>& function,
                                 const std::string& functionName = "hostFunction")
    requires((JSIDecodable<std::decay_t<Args>> && ...) && (std::is_void_v<R> || JSIEncodable<R>))
  {
    std::function<R(Args...)> copy = function;
    return toJSI(runtime, std::move(copy), functionName);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    return value.isObject() && value.getObject(runtime).isFunction(runtime);
  }

private:
  template <size_t... Is>
  static inline jsi::Value callFunction(jsi::Runtime& runtime, const std::function<R(Args...)>& function, const jsi::Value* args,
                                        std::index_sequence<Is...>) {
    if constexpr (std::is_void_v<R>) {
      function(JSIConverter<std::decay_t<Args>>::fromJSI(runtime, args[Is])...);
      return jsi::Value::undefined();
    } else {
      R result = function(JSIConverter<std::decay_t<Args>>::fromJSI(runtime, args[Is])...);
      return JSIConverter<std::remove_cvref_t<R>>::toJSI(runtime, std::forward<R>(result));
    }
  }
};

} // namespace margelo::nitro
