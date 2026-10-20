//
//  JSIConverter+Promise.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 29.09.26.
//

#include <NitroModules/JSIConverter+Promise.hpp>

namespace margelo::nitro {
  Promise<void> JSIConverter<Promise<void>>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    // Create new Promise and prepare onResolved / onRejected callbacks
    auto promise = Promise<void>::pending();
    // JS promise handlers receive one value even when the native promise discards it.
    auto thenCallback = JSIConverter<std::function<void(std::monostate)>>::toJSI(
        runtime, [promise](std::monostate) { promise.resolve(); }, "then");
    auto catchCallback = JSIConverter<std::function<void(std::exception_ptr)>>::toJSI(
        runtime, [promise](std::exception_ptr error) { promise.reject(std::move(error)); }, "catch");

    // Chain .then listeners on JS Promise (onResolved and onRejected)
    jsi::Object jsPromise = value.asObject(runtime);
    jsi::Function thenFn = jsPromise.getProperty(runtime, PropNameIDCache::get(runtime, "then")).asObject(runtime).getFunction(runtime);
    thenFn.callWithThis(runtime, jsPromise, thenCallback, catchCallback);

    return promise;
  }

  jsi::Value JSIConverter<Promise<void>>::toJSI(jsi::Runtime& runtime, const Promise<void>& promise) {
    if (promise.isResolved()) {
      // Already resolved!
      return CommonGlobals::Promise::resolved(runtime);
    } else if (const std::exception_ptr* error = promise.getErrorOrNull()) {
      // Already rejected!
      jsi::Value jsError = JSIConverter<std::exception_ptr>::toJSI(runtime, *error);
      return CommonGlobals::Promise::rejected(runtime, std::move(jsError));
    } else {
      // Still pending.
      jsi::HostFunctionType executor = [promise](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* arguments,
                                                 size_t) -> jsi::Value {
        // Add resolver listener
        auto resolver = JSIConverter<Callback<void()>>::fromJSI(runtime, arguments[0]);
        promise.addOnResolvedListener([resolver = std::move(resolver)]() { resolver.callAndForget(); });
        // Add rejecter listener
        auto rejecter = JSIConverter<Callback<void(std::exception_ptr)>>::fromJSI(runtime, arguments[1]);
        promise.addOnRejectedListener([rejecter = std::move(rejecter)](const std::exception_ptr& error) { rejecter.callAndForget(error); });

        return jsi::Value::undefined();
      };
      return CommonGlobals::Promise::callConstructor(runtime, std::move(executor));
    }
  }

  bool JSIConverter<Promise<void>>::canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) {
      return false;
    }
    jsi::Object object = value.getObject(runtime);
    return CommonGlobals::Promise::isInstanceOf(runtime, object);
  }
}
