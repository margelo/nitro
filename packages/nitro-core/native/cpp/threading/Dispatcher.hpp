//
// Created by Marc Rousavy on 12.03.24.
//

#pragma once

#include "NitroDefines.hpp"
#include "Promise.hpp"
#include <functional>
#include <jsi/jsi.h>
#include <queue>
#include <unordered_map>

namespace margelo::nitro {

using namespace facebook;

class Dispatcher : public jsi::NativeState {
public:
  /**
   Installs the Dispatcher into the given Runtime.
   It can be accessed using `getRuntimeGlobalDispatcher` later.
   */
  static void installRuntimeGlobalDispatcher(jsi::Runtime& runtime, std::shared_ptr<Dispatcher> dispatcher);
  /**
   Gets the global Dispatcher in the given Runtime, or throws an error if not found.
  */
  static std::shared_ptr<Dispatcher> getRuntimeGlobalDispatcher(jsi::Runtime& runtime);

private:
  static jsi::Value getRuntimeGlobalDispatcherHolder(jsi::Runtime& runtime);

public:
  /**
   * Run the given void function synchronously on the Thread this Dispatcher is managing.
   */
  virtual void runSync(std::function<void()>&& function) = 0;

  /**
   * Run the given void function asynchronously on the Thread this Dispatcher is managing.
   */
  virtual void runAsync(std::function<void()>&& function) = 0;

  /**
   * Run the given function asynchronously on the Thread this Dispatcher is managing,
   * and return a `Promise<T>` that will hold the result of the function.
   */
  template <typename T>
  std::shared_ptr<Promise<T>> runAsyncAwaitable(std::function<T()>&& function) {
    // 1. Create Promise that can be shared between this and dispatcher thread
    auto promise = Promise<T>::create();

    runAsync([function = std::move(function), promise]() {
      try {
        if constexpr (std::is_void_v<T>) {
          // 4. Call the actual function on the new Thread
          function();
          // 5.a. Resolve the Promise if we succeeded
          promise->resolve();
        } else {
          // 4. Call the actual function on the new Thread
          T result = function();
          // 5.a. Resolve the Promise if we succeeded
          promise->resolve(std::move(result));
        }
      } catch (...) {
        // 5.b. Reject the Promise if the call failed
        promise->reject(std::current_exception());
      }
    });

    // 3. Return an open `Promise<T>` that gets resolved later by the dispatcher Thread
    return promise;
  }

private:
  static std::unordered_map<jsi::Runtime * NON_NULL, std::weak_ptr<Dispatcher>> _globalCache;

private:
  static constexpr auto TAG = "Dispatcher";
};

} // namespace margelo::nitro
