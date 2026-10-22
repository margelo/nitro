//
//  Callback.hpp
//  Nitro
//
//  Created by Marc Rousavy on 23.02.25.
//

#pragma once

#include <NitroModules/BorrowingReference.hpp>
#include <NitroModules/Dispatcher.hpp>
#include <NitroModules/GlobalErrorHandler.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/NitroLogger.hpp>
#include <NitroModules/NitroTypeInfo.hpp>
#include <NitroModules/Promise.hpp>
#include <cassert>
#include <exception>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <utility>
#include <variant>

namespace margelo::nitro {

template <typename Signature>
class Callback;

/**
 * A Callback to either JS (`jsi::Function`) or native (`std::function`).
 *
 * Unlike `InlineCallback`, `Callback` is escapable, meaning it can be called
 * "later", e.g. stored as a class member and invoked at a later point in time.
 *
 * JS callbacks require their runtime's dispatcher for synchronous invocation;
 * asynchronous invocation schedules work there and returns a `Promise<T>`.
 * Native callbacks execute immediately on the calling thread in either case.
 * Their captures must support concurrent invocation and destruction when the
 * callback is shared across threads. Arguments and results retain their own
 * synchronization requirements.
 * Synchronous JS calls invoke the Dispatcher's JS entry hooks. The runtime host
 * controls microtask checkpoints through those hooks and its dispatched tasks.
 *
 * Swift imports every specialization with its `CxxCallback` and `Sendable`
 * conformances, so generated modules sharing a specialization do not declare them twice.
 */
template <typename R, typename... Args>
class SWIFT_CONFORMS_TO_PROTOCOL(NitroModules.CxxCallback) SWIFT_UNCHECKED_SENDABLE Callback<R(Args...)> final {
  friend JSIConverter<Callback>;
  template <typename, typename>
  friend struct SwiftCallbackConverter;
  template <typename, typename>
  friend struct JNICallbackConverter;

  struct JSCallback;
  using NativeCallback = std::function<R(Args...)>;

public:
  static Callback make(std::function<R(Args...)> function) {
    return Callback(std::move(function));
  }
  static Callback make(jsi::Runtime& runtime, BorrowingReference<jsi::Function>&& function, const std::shared_ptr<Dispatcher>& dispatcher) {
    return Callback(JSCallback(runtime, std::move(function), dispatcher));
  }

public:
  Callback(const Callback& other) = default;
  Callback(Callback&& other) = default;
  Callback& operator=(const Callback& other) = default;
  Callback& operator=(Callback&& other) = default;
  ~Callback() = default;

private:
  Callback(std::function<R(Args...)>&& function) : _impl(std::move(function)) {}
  Callback(JSCallback&& callback) : _impl(std::move(callback)) {}

public:
  using DefaultAsyncCallReturnT = std::conditional_t<std::is_void_v<R>, void, Promise<R>>;
  DefaultAsyncCallReturnT operator()(Args... args) const SWIFT_PRIVATE {
    if constexpr (std::is_void_v<R>) {
      callAndForget(std::forward<Args>(args)...);
    } else {
      return callAsync(std::forward<Args>(args)...);
    }
  }

public:
  [[nodiscard]] R callSync(Args... args) const SWIFT_PRIVATE {
    if (auto* nativeCallback = std::get_if<NativeCallback>(&_impl)) {
      // It holds a native Callback (`std::function`)
      return (*nativeCallback)(std::forward<Args>(args)...);
    } else {
      // It holds a JS Callback (`jsi::Function`)
      const auto& jsCallback = std::get<JSCallback>(_impl);
      return jsCallback.callSync(std::forward<Args>(args)...);
    }
  }

  [[nodiscard]] Promise<R> callAsync(Args... args) const SWIFT_PRIVATE {
    if (auto* nativeCallback = std::get_if<NativeCallback>(&_impl)) {
      // It holds a native Callback (`std::function`)
      try {
        if constexpr (std::is_void_v<R>) {
          (*nativeCallback)(std::forward<Args>(args)...);
          return Promise<R>::resolved();
        } else {
          R result = (*nativeCallback)(std::forward<Args>(args)...);
          return Promise<R>::resolved(std::move(result));
        }
      } catch (...) {
        return Promise<R>::rejected(std::current_exception());
      }
    } else {
      // It holds a JS Callback (`jsi::Function`)
      const auto& jsCallback = std::get<JSCallback>(_impl);
      return jsCallback.callAsync(std::forward<Args>(args)...);
    }
  }

  void callAndForget(Args... args) const SWIFT_PRIVATE {
    if (auto* nativeCallback = std::get_if<NativeCallback>(&_impl)) {
      // It holds a native Callback (`std::function`)
      try {
        (*nativeCallback)(std::forward<Args>(args)...);
      } catch (...) {
        GlobalErrorHandler::reportError(ErrorSource::NativeCallback, std::current_exception());
      }
    } else {
      // It holds a JS Callback (`jsi::Function`)
      const auto& jsCallback = std::get<JSCallback>(_impl);
      jsCallback.callAsyncAndForget(std::forward<Args>(args)...);
    }
  }

private:
  struct JSCallback {
    friend JSIConverter<Callback>;
    template <typename, typename>
    friend struct SwiftCallbackConverter;
    template <typename, typename>
    friend struct JNICallbackConverter;

  public:
    JSCallback(jsi::Runtime& runtime, BorrowingReference<jsi::Function>&& function, const std::weak_ptr<Dispatcher>& dispatcher)
        : _runtime(runtime), _function(std::move(function)), _dispatcher(dispatcher) {}

    R callSync(Args&&... args) const {
      std::shared_ptr<Dispatcher> dispatcher = _dispatcher.lock();
      if (!dispatcher) [[unlikely]] {
        // The caller is on the JS Thread and can catch this.
        throw std::runtime_error(getDispatcherDestroyedMessage());
      }
#ifdef NITRO_DEBUG
      assert(dispatcher->isOnDispatcher() && "callSync(...) must be called on the JS Runtime's context/Thread!");
#endif
      assertFunctionNotNull(_function);

      return dispatcher->withJSEntry(_runtime, [&]() -> R {
        if constexpr (std::is_void_v<R>) {
          _function->call(_runtime, JSIConverter<std::decay_t<Args>>::toJSI(_runtime, std::forward<Args>(args))...);
        } else {
          jsi::Value result = _function->call(_runtime, JSIConverter<std::decay_t<Args>>::toJSI(_runtime, std::forward<Args>(args))...);
          return JSIConverter<R>::fromJSI(_runtime, result);
        }
      });
    }
    Promise<R> callAsync(Args&&... args) const {
      std::shared_ptr<Dispatcher> dispatcher = _dispatcher.lock();
      if (!dispatcher) [[unlikely]] {
        // Native callers (e.g. Swift) cannot catch a throw here, so reject instead.
        return Promise<R>::rejected(std::make_exception_ptr(std::runtime_error(getDispatcherDestroyedMessage())));
      }
      jsi::Runtime& runtime = _runtime;
      return dispatcher->runAsyncAwaitable([&runtime, function = _function, ... args = std::move(args)]() mutable -> R {
        assertFunctionNotNull(function);

        try {
          if constexpr (std::is_void_v<R>) {
            function->call(runtime, JSIConverter<std::decay_t<Args>>::toJSI(runtime, std::forward<Args>(args))...);
          } else {
            jsi::Value result = function->call(runtime, JSIConverter<std::decay_t<Args>>::toJSI(runtime, std::forward<Args>(args))...);
            return JSIConverter<R>::fromJSI(runtime, result);
          }
        } catch (const jsi::JSError& error) {
          // A JSError holds a JS value, but the rejected Promise can outlive the Runtime,
          // e.g. in a garbage-collected Kotlin Promise. Keep only its message.
          throw std::runtime_error(error.what());
        }
      });
    }
    void callAsyncAndForget(Args&&... args) const {
      // Nobody observes the result, and native callers (e.g. Swift) cannot catch a throw,
      // so errors are reported to the `GlobalErrorHandler` like errors of native callbacks.
      // A destroyed Dispatcher means its Runtime is gone too, so there is nothing to report and we only log.
      std::shared_ptr<Dispatcher> dispatcher = _dispatcher.lock();
      if (!dispatcher) [[unlikely]] {
        Logger::log(LogLevel::Error, "Callback", "%s", getDispatcherDestroyedMessage().c_str());
        return;
      }
      jsi::Runtime& runtime = _runtime;
      dispatcher->runAsync([&runtime, function = _function, ... args = std::move(args)]() mutable -> void {
        try {
          assertFunctionNotNull(function);

          function->call(runtime, JSIConverter<std::decay_t<Args>>::toJSI(runtime, std::forward<Args>(args))...);
        } catch (...) {
          GlobalErrorHandler::reportError(ErrorSource::JSCallback, std::current_exception());
        }
      });
    }

  private:
    static std::string getDispatcherDestroyedMessage() {
      std::string typeName = TypeInfo::getFriendlyTypename<Callback<R(Args...)>>(true);
      return "Cannot call " + typeName + " - the underlying `Dispatcher` has already been destroyed!";
    }
    static void assertFunctionNotNull(const BorrowingReference<jsi::Function>& function) {
      if (!function) [[unlikely]] {
        std::string typeName = TypeInfo::getFriendlyTypename<Callback<R(Args...)>>(true);
        throw std::runtime_error("Cannot call " + typeName +
                                 " - the underlying `jsi::Function`/`jsi::Runtime` has already been destroyed!");
      }
    }

  private:
    // A reference_wrapper keeps the callback assignable, e.g. as the result of a Promise.
    std::reference_wrapper<jsi::Runtime> _runtime;
    BorrowingReference<jsi::Function> _function;
    std::weak_ptr<Dispatcher> _dispatcher;
  };
  std::variant<NativeCallback, JSCallback> _impl;
};

} // namespace margelo::nitro
