//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

// Forward declare a few of the common types that might have cyclic includes.
namespace margelo::nitro {
class JSICache;

template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include "Dispatcher.hpp"
#include "JSCallback.hpp"
#include "JSICache.hpp"
#include "PromiseType.hpp"
#include "PropNameIDCache.hpp"
#include <jsi/jsi.h>

namespace margelo::nitro {

using namespace facebook;

// [](Args...) -> T {} <> (Args...) => T
template <typename R, typename... Args>
struct JSIConverter<std::function<R(Args...)>> final {
  // Use AsyncJSCallback or SyncJSCallback
  inline static constexpr bool isAsync = is_promise_v<R> || std::is_void_v<R>;
  // Promise<T> -> T
  using ActualR = std::conditional_t<isAsync, promise_type_v<R>, R>;

  static inline std::function<R(Args...)> fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    // Make function global - it'll be managed by the Runtime's memory, and we only have a weak_ref to it.
    jsi::Function function = arg.asObject(runtime).asFunction(runtime);
    BorrowingReference<jsi::Function> sharedFunction;
    {
      // JSICache RAII should live as short as possible
      JSICacheReference cache = JSICache::getOrCreateCache(runtime);
      sharedFunction = cache.makeShared(std::move(function));
    }
    SyncJSCallback<ActualR(Args...)> callback(runtime, std::move(sharedFunction));

    if constexpr (isAsync) {
      // Return type is `Promise<T>` or `void` - it's an async callback!
      std::shared_ptr<Dispatcher> dispatcher = Dispatcher::getRuntimeGlobalDispatcher(runtime);
      return AsyncJSCallback<ActualR(Args...)>(std::move(callback), dispatcher);
    } else {
      // Return type is `T` - it's a sync callback!
      return callback;
    }
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, std::function<R(Args...)>&& function) {
    jsi::HostFunctionType jsFunction = [function = std::move(function)](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args,
                                                                        size_t count) -> jsi::Value {
      if (count != sizeof...(Args)) [[unlikely]] {
        throw jsi::JSError(runtime, "Function expected " + std::to_string(sizeof...(Args)) + " arguments, but received " +
                                        std::to_string(count) + "!");
      }
      return callHybridFunction(function, runtime, args, std::index_sequence_for<Args...>{});
    };
    return jsi::Function::createFromHostFunction(runtime,                                       //
                                                 PropNameIDCache::get(runtime, "hostFunction"), //
                                                 sizeof...(Args),                               //
                                                 std::move(jsFunction));
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const std::function<R(Args...)>& function) {
    std::function<R(Args...)> copy = function;
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
  static inline jsi::Value callHybridFunction(const std::function<R(Args...)>& function, jsi::Runtime& runtime, const jsi::Value* args,
                                              std::index_sequence<Is...>) {
    if constexpr (std::is_void_v<R>) {
      // it is a void function (will return undefined in JS)
      function(JSIConverter<std::decay_t<Args>>::fromJSI(runtime, args[Is])...);
      return jsi::Value::undefined();
    } else {
      // it is a custom type, parse it to a JS value
      R result = function(JSIConverter<std::decay_t<Args>>::fromJSI(runtime, args[Is])...);
      return JSIConverter<R>::toJSI(runtime, std::forward<R>(result));
    }
  }
};

} // namespace margelo::nitro
