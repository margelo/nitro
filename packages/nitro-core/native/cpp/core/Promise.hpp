//
// Created by Marc Rousavy on 18.11.24.
//

#pragma once

#include "AssertPromiseState.hpp"
#include "NitroDefines.hpp"
#include "NitroTypeInfo.hpp"
#include "ThreadPool.hpp"
#include <exception>
#include <future>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <variant>

namespace margelo::nitro {

using namespace facebook;

template <typename TResult>
class Promise final {
public:
  using OnResolvedFunc = std::function<void(const TResult&)>;
  using OnRejectedFunc = std::function<void(const std::exception_ptr&)>;

public:
  // Promise cannot be copied.
  Promise(const Promise&) = delete;

private:
  Promise() = default;

public:
  ~Promise() {
    if (isPending()) [[unlikely]] {
      auto message = std::string("Timeouted: Promise<") + TypeInfo::getFriendlyTypename<TResult>() + "> was destroyed!";
      reject(std::make_exception_ptr(std::runtime_error(message)));
    }
  }

public:
  /**
   * Creates a new pending Promise that has to be resolved
   * or rejected with `resolve(..)` or `reject(..)`.
   */
  static std::shared_ptr<Promise> create() {
    return std::shared_ptr<Promise>(new Promise());
  }

  /**
   * Creates a Promise that runs the given function `run` on a separate Thread pool.
   */
  static std::shared_ptr<Promise> async(std::function<TResult()>&& run) {
    auto promise = create();
    ThreadPool::shared().run([run = std::move(run), promise]() {
      try {
        // Run the code, then resolve.
        TResult result = run();
        promise->resolve(std::move(result));
      } catch (...) {
        // It threw an error.
        promise->reject(std::current_exception());
      }
    });
    return promise;
  }

  /**
   * Creates a Promise and awaits the given future on a background Thread.
   * Once the future resolves or rejects, the Promise resolves or rejects.
   */
  static std::shared_ptr<Promise> awaitFuture(std::future<TResult>&& future) {
    auto sharedFuture = std::make_shared<std::future<TResult>>(std::move(future));
    return async([sharedFuture = std::move(sharedFuture)]() { return sharedFuture->get(); });
  }

  /**
   * Creates an immediately resolved Promise.
   */
  static std::shared_ptr<Promise> resolved(TResult&& result) {
    auto promise = create();
    promise->resolve(std::move(result));
    return promise;
  }
  /**
   * Creates an immediately rejected Promise.
   */
  static std::shared_ptr<Promise> rejected(const std::exception_ptr& error) {
    auto promise = create();
    promise->reject(error);
    return promise;
  }

public:
  /**
   * Resolves this Promise with the given result, and calls any pending listeners.
   */
  void resolve(TResult&& result) {
#ifdef NITRO_DEBUG
    assertPromiseState(*this, PromiseTask::WANTS_TO_RESOLVE);
#endif
    std::vector<OnResolvedFunc> listeners;
    std::vector<OnRejectedFunc> dropped;
    const TResult* resolvedValue;
    {
      std::unique_lock lock(_mutex);
      _state = std::move(result);
      resolvedValue = &std::get<TResult>(_state);
      listeners = std::move(_onResolvedListeners);
      dropped = std::move(_onRejectedListeners);
    }
    for (const auto& onResolved : listeners) {
      onResolved(*resolvedValue);
    }
  }
  void resolve(const TResult& result) {
#ifdef NITRO_DEBUG
    assertPromiseState(*this, PromiseTask::WANTS_TO_RESOLVE);
#endif
    std::vector<OnResolvedFunc> listeners;
    std::vector<OnRejectedFunc> dropped;
    {
      std::unique_lock lock(_mutex);
      _state = result;
      listeners = std::move(_onResolvedListeners);
      dropped = std::move(_onRejectedListeners);
    }
    for (const auto& onResolved : listeners) {
      onResolved(result);
    }
  }
  /**
   * Rejects this Promise with the given error, and calls any pending listeners.
   */
  void reject(const std::exception_ptr& exception) {
    if (exception == nullptr) [[unlikely]] {
      std::string typeName = TypeInfo::getFriendlyTypename<TResult>(true);
      throw std::runtime_error("Cannot reject Promise<" + typeName + "> with a null exception_ptr!");
    }

#ifdef NITRO_DEBUG
    assertPromiseState(*this, PromiseTask::WANTS_TO_REJECT);
#endif
    std::vector<OnRejectedFunc> listeners;
    std::vector<OnResolvedFunc> dropped;
    {
      std::unique_lock lock(_mutex);
      _state = exception;
      listeners = std::move(_onRejectedListeners);
      dropped = std::move(_onResolvedListeners);
    }
    for (const auto& onRejected : listeners) {
      onRejected(exception);
    }
  }

public:
  /**
   * Add a listener that will be called when the Promise gets resolved.
   * If the Promise is already resolved, the listener will be immediately called.
   */
  void addOnResolvedListener(OnResolvedFunc&& onResolved) {
    std::unique_lock lock(_mutex);
    if (std::holds_alternative<TResult>(_state)) {
      const TResult& result = std::get<TResult>(_state);
      lock.unlock();
      // Promise is already resolved! Call the callback immediately
      onResolved(result);
    } else {
      // Promise is not yet resolved, put the listener in our queue.
      _onResolvedListeners.push_back(std::move(onResolved));
    }
  }
  void addOnResolvedListener(const OnResolvedFunc& onResolved) {
    std::unique_lock lock(_mutex);
    if (std::holds_alternative<TResult>(_state)) {
      const TResult& result = std::get<TResult>(_state);
      lock.unlock();
      // Promise is already resolved! Call the callback immediately
      onResolved(result);
    } else {
      // Promise is not yet resolved, put the listener in our queue.
      _onResolvedListeners.push_back(onResolved);
    }
  }

  /**
   * Add a listener that will be called when the Promise gets rejected.
   * If the Promise is already rejected, the listener will be immediately called.
   */
  void addOnRejectedListener(OnRejectedFunc&& onRejected) {
    std::unique_lock lock(_mutex);
    if (std::holds_alternative<std::exception_ptr>(_state)) {
      std::exception_ptr error = std::get<std::exception_ptr>(_state);
      lock.unlock();
      // Promise is already rejected! Call the callback immediately
      onRejected(error);
    } else {
      // Promise is not yet rejected, put the listener in our queue.
      _onRejectedListeners.push_back(std::move(onRejected));
    }
  }
  void addOnRejectedListener(const OnRejectedFunc& onRejected) {
    std::unique_lock lock(_mutex);
    if (std::holds_alternative<std::exception_ptr>(_state)) {
      std::exception_ptr error = std::get<std::exception_ptr>(_state);
      lock.unlock();
      // Promise is already rejected! Call the callback immediately
      onRejected(error);
    } else {
      // Promise is not yet rejected, put the listener in our queue.
      _onRejectedListeners.push_back(onRejected);
    }
  }

public:
  /**
   * Gets an awaitable `std::future<T>` for this `Promise<T>`.
   */
  std::future<TResult> await() {
    auto promise = std::make_shared<std::promise<TResult>>();
    addOnResolvedListener([promise](const TResult& result) { promise->set_value(result); });
    addOnRejectedListener([promise](const std::exception_ptr& error) { promise->set_exception(error); });
    return promise->get_future();
  }

public:
  /**
   * Get the result of the Promise if it has been resolved.
   * If the Promise is not resolved, this will throw.
   */
  inline const TResult& getResult() const {
    std::unique_lock lock(_mutex);
    if (!isResolved(lock)) {
      std::string typeName = TypeInfo::getFriendlyTypename<TResult>(true);
      throw std::runtime_error("Cannot get result when Promise<" + typeName + "> is not yet resolved!");
    }
    return std::get<TResult>(_state);
  }
  /**
   * Get the error of the Promise if it has been rejected.
   * If the Promise is not rejected, this will throw.
   */
  inline const std::exception_ptr& getError() const {
    std::unique_lock lock(_mutex);
    if (!isRejected(lock)) {
      std::string typeName = TypeInfo::getFriendlyTypename<TResult>(true);
      throw std::runtime_error("Cannot get error when Promise<" + typeName + "> is not yet rejected!");
    }
    return std::get<std::exception_ptr>(_state);
  }

public:
  /**
   * Gets whether this Promise has been successfully resolved with a result, or not.
   */
  [[nodiscard]]
  inline bool isResolved() const noexcept {
    std::unique_lock lock(_mutex);
    return isResolved(lock);
  }
  /**
   * Gets whether this Promise has been rejected with an error, or not.
   */
  [[nodiscard]]
  inline bool isRejected() const noexcept {
    std::unique_lock lock(_mutex);
    return isRejected(lock);
  }
  /**
   * Gets whether this Promise has not yet been resolved nor rejected.
   */
  [[nodiscard]]
  inline bool isPending() const noexcept {
    std::unique_lock lock(_mutex);
    return isPending(lock);
  }

private:
  [[nodiscard]]
  inline bool isResolved(const std::unique_lock<std::mutex>&) const noexcept {
    return std::holds_alternative<TResult>(_state);
  }
  [[nodiscard]]
  inline bool isRejected(const std::unique_lock<std::mutex>&) const noexcept {
    return std::holds_alternative<std::exception_ptr>(_state);
  }
  [[nodiscard]]
  inline bool isPending(const std::unique_lock<std::mutex>&) const noexcept {
    return std::holds_alternative<std::monostate>(_state);
  }

private:
  std::variant<std::monostate, TResult, std::exception_ptr> _state;
  std::vector<OnResolvedFunc> _onResolvedListeners;
  std::vector<OnRejectedFunc> _onRejectedListeners;
  mutable std::mutex _mutex;
};

// Specialization for void
template <>
class Promise<void> final {
public:
  using OnResolvedFunc = std::function<void()>;
  using OnRejectedFunc = std::function<void(const std::exception_ptr&)>;

public:
  Promise(const Promise&) = delete;
  Promise(Promise&&) = delete;
  ~Promise();

private:
  Promise() = default;

public:
  static std::shared_ptr<Promise> create();
  static std::shared_ptr<Promise> async(std::function<void()>&& run);
  static std::shared_ptr<Promise> awaitFuture(std::future<void>&& future);
  static std::shared_ptr<Promise> resolved();
  static std::shared_ptr<Promise> rejected(const std::exception_ptr& error);

public:
  void resolve();
  void reject(const std::exception_ptr& exception);

public:
  void addOnResolvedListener(OnResolvedFunc&& onResolved);
  void addOnResolvedListener(const OnResolvedFunc& onResolved);
  void addOnRejectedListener(OnRejectedFunc&& onRejected);
  void addOnRejectedListener(const OnRejectedFunc& onRejected);

public:
  std::future<void> await();

public:
  const std::exception_ptr& getError() const;

public:
  inline bool isResolved() const noexcept {
    std::unique_lock lock(_mutex);
    return isResolved(lock);
  }
  inline bool isRejected() const noexcept {
    std::unique_lock lock(_mutex);
    return isRejected(lock);
  }
  inline bool isPending() const noexcept {
    std::unique_lock lock(_mutex);
    return isPending(lock);
  }

private:
  inline bool isResolved(const std::unique_lock<std::mutex>&) const noexcept {
    return _isResolved;
  }
  inline bool isRejected(const std::unique_lock<std::mutex>&) const noexcept {
    return _error != nullptr;
  }
  inline bool isPending(const std::unique_lock<std::mutex>&) const noexcept {
    return !_isResolved && _error == nullptr;
  }

private:
  mutable std::mutex _mutex;
  bool _isResolved = false;
  std::exception_ptr _error;
  std::vector<OnResolvedFunc> _onResolvedListeners;
  std::vector<OnRejectedFunc> _onRejectedListeners;
};

} // namespace margelo::nitro
