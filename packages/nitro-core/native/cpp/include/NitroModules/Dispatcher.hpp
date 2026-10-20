//
// Created by Marc Rousavy on 12.03.24.
//

#pragma once

#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/Promise.hpp>
#include <concepts>
#include <functional>
#include <jsi/jsi.h>
#include <queue>
#include <type_traits>
#include <unordered_map>
#include <utility>

namespace margelo::nitro {

using namespace facebook;

class Dispatcher : public jsi::NativeState {
public:
  /**
   Installs the Dispatcher into the given Runtime, which keeps it alive until the Runtime is destroyed.
   It can be accessed using `getRuntimeGlobalDispatcher` later.
   In debug, this throws if the Runtime already has a Dispatcher.
   */
  static void installRuntimeGlobalDispatcher(jsi::Runtime& runtime, std::shared_ptr<Dispatcher> dispatcher);
  /**
   Gets the Dispatcher of the given Runtime, or throws an error if not found.
  */
  static std::shared_ptr<Dispatcher> getRuntimeGlobalDispatcher(jsi::Runtime& runtime);

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
   * Returns whether the current caller is currently on the Dispatcher's environment.
   *
   * For a Dispatcher backed by a Thread, this returns true if called on that exact Thread,
   * and false otherwise.
   */
  virtual bool isOnDispatcher() = 0;

  /**
   * Host hooks for synchronous entries into JS on this Dispatcher's context.
   * Hosts that already manage JS execution, such as React Native, can leave
   * these as no-ops. Standalone hosts can track nesting and checkpoint on exit.
   * A successful enterJS must be paired with leaveJS, including on exceptions.
   */
  virtual void enterJS(jsi::Runtime&) {}
  virtual void leaveJS(jsi::Runtime&) noexcept {}

  /**
   * Invoke inline within a host JS entry, including argument/result conversion.
   * This does not dispatch or change threads. Hosts should also use this scope
   * around evaluation and complete dispatched tasks, including Promise settlement.
   */
  template <typename Func>
  decltype(auto) withJSEntry(jsi::Runtime& runtime, Func&& function) {
    enterJS(runtime);
    struct Entry {
      Dispatcher& dispatcher;
      jsi::Runtime& runtime;
      ~Entry() { dispatcher.leaveJS(runtime); }
    } entry{*this, runtime};
    return std::invoke(std::forward<Func>(function));
  }

  /**
   * Run the given function asynchronously on the Thread this Dispatcher is managing,
   * and return a `Promise<T>`, with `T` inferred from the callable's return type.
   * The callable is copied or moved into the queued task and must be copy-constructible.
   */
  template <typename Func>
    requires std::invocable<std::decay_t<Func>&>
  auto runAsyncAwaitable(Func&& function) {
    using T = std::invoke_result_t<std::decay_t<Func>&>;

    // 1. Create Promise that can be shared between this and dispatcher thread
    auto promise = Promise<T>::pending();

    runAsync([function = std::forward<Func>(function), promise]() mutable {
      try {
        if constexpr (std::is_pointer_v<std::decay_t<Func>>) {
          if (function == nullptr) {
            throw std::bad_function_call();
          }
        }
        if constexpr (std::is_void_v<T>) {
          // 4. Call the actual function on the new Thread
          std::invoke(function);
          // 5.a. Resolve the Promise if we succeeded
          promise.resolve();
        } else {
          // 4. Call the actual function on the new Thread
          T result = std::invoke(function);
          // 5.a. Resolve the Promise if we succeeded
          promise.resolve(std::move(result));
        }
      } catch (...) {
        // 5.b. Reject the Promise if the call failed
        promise.reject(std::current_exception());
      }
    });

    // 3. Return an open `Promise<T>` that gets resolved later by the dispatcher Thread
    return promise;
  }

private:
  static constexpr auto TAG = "Dispatcher";
};

} // namespace margelo::nitro
