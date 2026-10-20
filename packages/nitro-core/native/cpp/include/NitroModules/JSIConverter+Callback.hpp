//
// JSI conversions for Callback and InlineCallback.
//

#pragma once

// The callback headers also include JSIConverter.hpp before defining these types.
namespace margelo::nitro {
template <typename Signature>
class InlineCallback;
template <typename Signature>
class Callback;
} // namespace margelo::nitro

#include <NitroModules/Callback.hpp>
#include <NitroModules/InlineCallback.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/PropNameIDCache.hpp>
#include <cassert>
#include <jsi/jsi.h>
#include <type_traits>
#include <utility>

namespace margelo::nitro {

using namespace facebook;

// Calling a decoded JS function encodes its arguments and decodes its result.
template <typename R, typename... Args>
concept JSICallbackDecodable = (JSIEncodable<Args> && ...) && (std::is_void_v<R> || JSIDecodable<R>);

// Callback::callSync also instantiates its JS implementation when wrapping a native callback.
template <typename R, typename... Args>
concept JSICallbackEncodable =
    JSICallbackDecodable<R, Args...> && (JSIDecodable<std::decay_t<Args>> && ...) && (std::is_void_v<R> || JSIEncodable<R>);

// [](Args...) -> T {} <> (Args...) => T
template <typename R, typename... Args>
struct JSIConverter<InlineCallback<R(Args...)>> final {
  // TODO: Implement `InlineCallback` caching via `jsi::NativeState` on the JS object?
  //       In fromJSI() we can try unwrapping JSCallback from the JS Object's NativeState

  static inline InlineCallback<R(Args...)> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg)
    requires JSICallbackDecodable<R, Args...>
  {
    jsi::Function function = arg.asObject(runtime).asFunction(runtime);
    return InlineCallback<R(Args...)>::make(runtime, std::move(function));
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const InlineCallback<R(Args...)>& callback)
    requires JSICallbackEncodable<R, Args...>
  {
    if (auto* jsCallback = std::get_if<typename InlineCallback<R(Args...)>::JSCallback>(&callback._impl)) {
      assert(&runtime == &jsCallback->_runtime && "Cannot reuse a JS Callback across different JS Runtimes!");
      return jsi::Value(runtime, jsCallback->_function);
    }
    Callback<R(Args...)> escaped = callback.escape();
    return JSIConverter<Callback<R(Args...)>>::toJSI(runtime, std::move(escaped));
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isObject()) {
      jsi::Object object = value.getObject(runtime);
      return object.isFunction(runtime);
    }
    return false;
  }
};

// [](Args...) -> T {} <> (Args...) => T
template <typename R, typename... Args>
struct JSIConverter<Callback<R(Args...)>> final {
  // TODO: Implement `Callback` caching via `jsi::NativeState` on the JS object?
  //       In fromJSI() we can try unwrapping JSCallback from the JS Object's NativeState

  static inline Callback<R(Args...)> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg)
    requires JSICallbackDecodable<R, Args...>
  {
    InlineCallback<R(Args...)> callback = JSIConverter<InlineCallback<R(Args...)>>::fromJSI(runtime, arg);
    return std::move(callback).escape();
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, Callback<R(Args...)>&& callback)
    requires JSICallbackEncodable<R, Args...>
  {
    if (auto* jsCallback = std::get_if<typename Callback<R(Args...)>::JSCallback>(&callback._impl)) {
      assert(&runtime == &jsCallback->_runtime.get() && "Cannot reuse a JS Callback across different JS Runtimes!");
      jsCallback->assertFunctionNotNull(jsCallback->_function);
      return jsi::Value(runtime, *jsCallback->_function);
    }
    jsi::HostFunctionType jsFunction = [callback = std::move(callback)](jsi::Runtime& runtime,  //
                                                                        const jsi::Value&,      //
                                                                        const jsi::Value* args, //
                                                                        size_t count) -> jsi::Value {
      if (count != sizeof...(Args)) [[unlikely]] {
        throw jsi::JSError(runtime, "Callback expected " + std::to_string(sizeof...(Args)) + " arguments, but received " +
                                        std::to_string(count) + "!");
      }
      return callCallback(runtime, callback, args, std::index_sequence_for<Args...>{});
    };
    return jsi::Function::createFromHostFunction(runtime,                                   //
                                                 PropNameIDCache::get(runtime, "callback"), //
                                                 sizeof...(Args),                           //
                                                 std::move(jsFunction));
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const Callback<R(Args...)>& callback)
    requires JSICallbackEncodable<R, Args...>
  {
    Callback<R(Args...)> copy = callback;
    return toJSI(runtime, std::move(copy));
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isObject()) {
      jsi::Object object = value.getObject(runtime);
      return object.isFunction(runtime);
    }
    return false;
  }

private:
  template <size_t... Is>
  static inline jsi::Value callCallback(jsi::Runtime& runtime, const Callback<R(Args...)>& callback, const jsi::Value* args,
                                        std::index_sequence<Is...>) {
    if constexpr (std::is_void_v<R>) {
      callback.callSync(JSIConverter<std::decay_t<Args>>::fromJSI(runtime, args[Is])...);
      return jsi::Value::undefined();
    } else {
      R result = callback.callSync(JSIConverter<std::decay_t<Args>>::fromJSI(runtime, args[Is])...);
      return JSIConverter<std::decay_t<R>>::toJSI(runtime, std::forward<R>(result));
    }
  }
};

} // namespace margelo::nitro
