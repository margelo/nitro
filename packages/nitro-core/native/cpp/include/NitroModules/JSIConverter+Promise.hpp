//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/CommonGlobals.hpp>
#include <NitroModules/Dispatcher.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/NitroTypeInfo.hpp>
#include <NitroModules/Null.hpp>
#include <NitroModules/Promise.hpp>
#include <NitroModules/PropNameIDCache.hpp>
#include <exception>
#include <functional>
#include <jsi/jsi.h>
#include <memory>

namespace margelo::nitro {

using namespace facebook;

  // Native Promise<T> <> JavaScript Promise<T>
  template <typename TResult>
  struct JSIConverter<Promise<TResult>> final {
    static_assert(!std::is_void_v<TResult>, "Use the JSIConverter<Promise<void>> specialization!");
    using TError = typename Promise<TResult>::TError;

    static inline Promise<TResult> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
      requires(JSIDecodable<TResult> && std::constructible_from<TResult, TResult>)
    {
      // Create new Promise and prepare onResolved / onRejected callbacks
      auto promise = Promise<TResult>::pending();
      auto thenCallback = JSIConverter<std::function<void(TResult)>>::toJSI(
          runtime, [promise](TResult result) { promise.resolve(std::move(result)); }, "then");
      auto catchCallback =
          JSIConverter<std::function<void(TError)>>::toJSI(runtime, [promise](TError error) { promise.reject(std::move(error)); }, "catch");

      // Chain .then listeners on JS Promise (onResolved and onRejected)
      jsi::Object jsPromise = value.asObject(runtime);
      jsi::Function thenFn = jsPromise.getProperty(runtime, PropNameIDCache::get(runtime, "then")).asObject(runtime).getFunction(runtime);
      thenFn.callWithThis(runtime, jsPromise, thenCallback, catchCallback);

      return promise;
    }

    static inline jsi::Value toJSI(jsi::Runtime& runtime, const Promise<TResult>& promise)
      requires(JSIEncodable<const TResult&> && JSIEncodable<TResult>)
    {
      if (const TResult* result = promise.getResultOrNull()) {
        // It's already resolved!
        try {
          jsi::Value jsResult = JSIConverter<std::remove_cvref_t<TResult>>::toJSI(runtime, *result);
          return CommonGlobals::Promise::resolved(runtime, std::move(jsResult));
        } catch (...) {
          // Reject conversion errors even if the native Promise settled before bridging.
          jsi::Value jsError = JSIConverter<TError>::toJSI(runtime, std::current_exception());
          return CommonGlobals::Promise::rejected(runtime, std::move(jsError));
        }
      } else if (const TError* error = promise.getErrorOrNull()) {
        // It's already rejected!
        jsi::Value jsError = JSIConverter<TError>::toJSI(runtime, *error);
        return CommonGlobals::Promise::rejected(runtime, std::move(jsError));
      } else {
        // It's pending, add listeners for later.
        jsi::HostFunctionType executor = [promise](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* arguments,
                                                   size_t) -> jsi::Value {
          auto resolver = JSIConverter<Callback<void(TResult)>>::fromJSI(runtime, arguments[0]);
          auto rejecter = JSIConverter<Callback<void(TError)>>::fromJSI(runtime, arguments[1]);
          std::weak_ptr<Dispatcher> weakDispatcher = Dispatcher::getRuntimeGlobalDispatcher(runtime);
          // Add resolver listener
          promise.addOnResolvedListener([weakDispatcher, resolver, rejecter](const TResult& result) {
            std::shared_ptr<Dispatcher> dispatcher = weakDispatcher.lock();
            if (!dispatcher) [[unlikely]] {
              // The Runtime is gone, so there is no JS Promise left to resolve.
              return;
            }
            dispatcher->runAsync([resolver, rejecter, result = TResult(result)]() mutable {
              try {
                resolver.callSync(std::move(result));
              } catch (...) {
                // Converting the result can fail, e.g. for an invalid `AnyJSON`.
                rejecter.callAndForget(std::current_exception());
              }
            });
          });
          // Add rejecter listener
          promise.addOnRejectedListener([rejecter = std::move(rejecter)](const TError& error) { rejecter.callAndForget(error); });

          return jsi::Value::undefined();
        };
        return CommonGlobals::Promise::callConstructor(runtime, std::move(executor));
      }
    }

    static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
      if (!value.isObject()) {
        return false;
      }
      jsi::Object object = value.getObject(runtime);
      return CommonGlobals::Promise::isInstanceOf(runtime, object);
    }
  };

  // Promise<void> <> Promise<undefined>
  template <>
  struct JSIConverter<Promise<void>> final {
    static Promise<void> fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
    static jsi::Value toJSI(jsi::Runtime& runtime, const Promise<void>& promise);
    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
  };

} // namespace margelo::nitro
