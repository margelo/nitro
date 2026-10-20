//
// Created by Marc Rousavy on 18.11.24.
//

#pragma once

#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/NitroLogger.hpp>
#include <NitroModules/NitroTypeInfo.hpp>
#include <NitroModules/ThreadPool.hpp>
#include <exception>
#include <future>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <variant>

namespace margelo::nitro {

using namespace facebook;

template <typename TResult>
class Promise final {
public:
  using TError = std::exception_ptr;
  using TPending = std::monostate;
  using OnResolvedFunc = std::function<void(const TResult&)>;
  using OnRejectedFunc = std::function<void(const TError&)>;

private:
  Promise(): _state(std::make_shared<State>()) { }

public:
  static Promise<TResult> pending() SWIFT_PRIVATE;

  /**
   * Runs the given function on the shared ThreadPool and resolves or rejects with its outcome.
   */
  static Promise<TResult> async(std::function<TResult()>&& run) {
    auto promise = pending();
    ThreadPool::shared().run([run = std::move(run), promise]() {
      try {
        promise.resolve(run());
      } catch (...) {
        promise.reject(std::current_exception());
      }
    });
    return promise;
  }

  /**
   * Waits for the given future on the shared ThreadPool and forwards its result or exception.
   */
  // Keep std::future<T> out of Swift import: its layout requires a complete T.
  template <typename T = TResult>
    requires std::is_same_v<T, TResult>
  static Promise<TResult> awaitFuture(std::future<T>&& future) {
    auto sharedFuture = std::make_shared<std::future<TResult>>(std::move(future));
    return async([sharedFuture = std::move(sharedFuture)]() { return sharedFuture->get(); });
  }

  static Promise<TResult> resolved(TResult&& result) {
    Promise<TResult> promise;
    promise.resolve(std::move(result));
    return promise;
  }
  static Promise<TResult> rejected(TError&& error) {
    Promise<TResult> promise;
    promise.reject(std::move(error));
    return promise;
  }

public:
  void resolve(TResult&& result) const {
    // Keep the state alive even if a listener destroys this Promise.
    const auto state = _state;
    std::unique_lock lock(state->mutex);
    assert(std::holds_alternative<TPending>(state->result) && "Promise<T> cannot be resolved/rejected twice!");
    state->result = std::move(result);
    auto listeners = std::move(state->onResolvedListeners);
    auto dropped = std::move(state->onRejectedListeners);
    const TResult& resolved = std::get<TResult>(state->result);

    lock.unlock();
    for (const auto& listener : listeners) {
      listener(resolved);
    }
  }
  void reject(TError&& error) const;

public:
  // TODO: Make this template std::invocable ?
  void addOnResolvedListener(OnResolvedFunc onResolved) const {
    std::unique_lock lock(_state->mutex);
    if (std::holds_alternative<TPending>(_state->result)) {
      // It's still pending - add listener for later
      _state->onResolvedListeners.push_back(std::move(onResolved));
    } else if (std::holds_alternative<TResult>(_state->result)) {
      // It's already resolved - call listener now
      const auto state = _state;
      const TResult& result = std::get<TResult>(state->result);
      lock.unlock();
      onResolved(result);
    } else {
      // It's already rejected - we can just drop the listener.
    }
  }
  // TODO: Make this template std::invocable ?
  void addOnRejectedListener(OnRejectedFunc onRejected) const;

public:
  /**
   * Gets a future that receives this Promise's result or exception.
   */
  template <typename T = TResult>
    requires std::is_same_v<T, TResult>
  std::future<T> await() const {
    auto promise = std::make_shared<std::promise<TResult>>();
    auto future = promise->get_future();
    addOnResolvedListener([promise](const TResult& result) { promise->set_value(result); });
    addOnRejectedListener([promise](const TError& error) { promise->set_exception(error); });
    return future;
  }

public:
  [[nodiscard]]
  bool isPending() const {
    std::unique_lock lock(_state->mutex);
    return std::holds_alternative<TPending>(_state->result);
  }
  [[nodiscard]]
  const TResult* getResultOrNull() const {
    std::unique_lock lock(_state->mutex);
    return std::get_if<TResult>(&_state->result);
  }
  [[nodiscard]]
  const TError* getErrorOrNull() const {
    std::unique_lock lock(_state->mutex);
    return std::get_if<TError>(&_state->result);
  }


private:
  struct State {
    std::mutex mutex;
    std::variant<TPending, TResult, TError> result;
    std::vector<OnResolvedFunc> onResolvedListeners;
    std::vector<OnRejectedFunc> onRejectedListeners;
    State(): mutex(), result(std::monostate()), onResolvedListeners(), onRejectedListeners() {}
    ~State() {
      if (std::holds_alternative<TPending>(result)) {
        auto typeName = TypeInfo::getFriendlyTypename<Promise<TResult>>();
        Logger::log(LogLevel::Warning, "Promise", "%s was destroyed while still pending!", typeName.c_str());
        result = std::make_exception_ptr(std::runtime_error(std::string("Timeouted! ") + typeName + " was destroyed in native."));
        const TError& error = std::get<TError>(result);
        for (const auto& listener : onRejectedListeners) {
          listener(error);
        }
      }
    }
  };
  std::shared_ptr<State> _state;
};


// Keep these definitions out of line so importing Promise<T> does not require
// a complete T. Swift bridges call payload-dependent methods from C++ after
// the generated Swift header has defined the payload.
template <typename TResult>
Promise<TResult> Promise<TResult>::pending() {
  return Promise<TResult>();
}

template <typename TResult>
void Promise<TResult>::reject(TError&& error) const {
  if (error == nullptr) [[unlikely]] {
    auto typeName = TypeInfo::getFriendlyTypename<TResult>(true);
    throw std::runtime_error("Cannot reject Promise<" + typeName + "> with a null exception_ptr!");
  }

  // Keep the state alive even if a listener destroys this Promise.
  const auto state = _state;
  std::unique_lock lock(state->mutex);
  assert(std::holds_alternative<TPending>(state->result) && "Promise<T> cannot be resolved/rejected twice!");
  state->result = std::move(error);
  auto listeners = std::move(state->onRejectedListeners);
  auto dropped = std::move(state->onResolvedListeners);
  const TError& rejected = std::get<TError>(state->result);

  lock.unlock();
  for (const auto& listener : listeners) {
    listener(rejected);
  }
}

template <typename TResult>
void Promise<TResult>::addOnRejectedListener(OnRejectedFunc onRejected) const {
  std::unique_lock lock(_state->mutex);
  if (std::holds_alternative<TPending>(_state->result)) {
    // It's still pending - add listener for later
    _state->onRejectedListeners.push_back(std::move(onRejected));
  } else if (std::holds_alternative<TError>(_state->result)) {
    // It's already rejected - call listener now
    const auto state = _state;
    const TError& error = std::get<TError>(state->result);
    lock.unlock();
    onRejected(error);
  } else {
    // It's already resolved - we can just drop the listener.
  }
}

template <>
class Promise<void> final {
public:
  using TError = std::exception_ptr;
  using OnResolvedFunc = std::function<void()>;
  using OnRejectedFunc = std::function<void(const TError&)>;

private:
  Promise();

public:
  static Promise pending() SWIFT_PRIVATE {
    return Promise();
  }

  /**
   * Runs the given function on the shared ThreadPool and resolves or rejects with its outcome.
   */
  static Promise async(std::function<void()>&& run);

  /**
   * Waits for the given future on the shared ThreadPool and forwards its result or exception.
   */
  static Promise awaitFuture(std::future<void>&& future);

  static Promise resolved() {
    Promise promise;
    promise.resolve();
    return promise;
  }
  static Promise rejected(TError&& error) {
    Promise promise;
    promise.reject(std::move(error));
    return promise;
  }

public:
  void resolve() const;
  void reject(TError&& error) const;

public:
  // TODO: Make this template std::invocable ?
  void addOnResolvedListener(OnResolvedFunc onResolved) const;
  // TODO: Make this template std::invocable ?
  void addOnRejectedListener(OnRejectedFunc onRejected) const;

public:
  /**
   * Gets a future that receives this Promise's completion or exception.
   */
  std::future<void> await() const;

public:
  [[nodiscard]]
  bool isPending() const;
  [[nodiscard]]
  bool isResolved() const;
  [[nodiscard]]
  const TError* getErrorOrNull() const;

private:
  struct State {
    std::mutex mutex;
    bool isResolved;
    TError error;
    std::vector<OnResolvedFunc> onResolvedListeners;
    std::vector<OnRejectedFunc> onRejectedListeners;
    State(): mutex(), isResolved(false), error(nullptr), onResolvedListeners(), onRejectedListeners() {}
    ~State();
  };
  std::shared_ptr<State> _state;
};

} // namespace margelo::nitro
