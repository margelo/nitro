//
//  Promise.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 18.11.24.
//

#include "Promise.hpp"

namespace margelo::nitro {

Promise<void>::~Promise() {
  if (isPending()) [[unlikely]] {
    std::runtime_error error("Timeouted: Promise<void> was destroyed!");
    reject(std::make_exception_ptr(error));
  }
}

std::shared_ptr<Promise<void>> Promise<void>::create() {
  return std::shared_ptr<Promise<void>>(new Promise());
}

std::shared_ptr<Promise<void>> Promise<void>::async(std::function<void()>&& run) {
  auto promise = create();
  ThreadPool::shared().run([run = std::move(run), promise]() {
    try {
      // Run the code, then resolve.
      run();
      promise->resolve();
    } catch (...) {
      // It threw an error.
      promise->reject(std::current_exception());
    }
  });
  return promise;
}

std::shared_ptr<Promise<void>> Promise<void>::awaitFuture(std::future<void>&& future) {
  auto sharedFuture = std::make_shared<std::future<void>>(std::move(future));
  return async([sharedFuture = std::move(sharedFuture)]() { sharedFuture->get(); });
}

std::shared_ptr<Promise<void>> Promise<void>::resolved() {
  auto promise = create();
  promise->resolve();
  return promise;
}
std::shared_ptr<Promise<void>> Promise<void>::rejected(const std::exception_ptr& error) {
  auto promise = create();
  promise->reject(error);
  return promise;
}

void Promise<void>::resolve() {
#ifdef NITRO_DEBUG
  assertPromiseState(*this, PromiseTask::WANTS_TO_RESOLVE);
#endif
  std::vector<OnResolvedFunc> listeners;
  std::vector<OnRejectedFunc> dropped;
  {
    std::unique_lock lock(_mutex);
    _isResolved = true;
    listeners = std::move(_onResolvedListeners);
    dropped = std::move(_onRejectedListeners);
  }
  for (const auto& onResolved : listeners) {
    onResolved();
  }
}

void Promise<void>::reject(const std::exception_ptr& exception) {
  if (exception == nullptr) [[unlikely]] {
    throw std::runtime_error("Cannot reject Promise<void> with a null exception_ptr!");
  }

#ifdef NITRO_DEBUG
  assertPromiseState(*this, PromiseTask::WANTS_TO_REJECT);
#endif
  std::vector<OnRejectedFunc> listeners;
  std::vector<OnResolvedFunc> dropped;
  {
    std::unique_lock lock(_mutex);
    _error = exception;
    listeners = std::move(_onRejectedListeners);
    dropped = std::move(_onResolvedListeners);
  }
  for (const auto& onRejected : listeners) {
    onRejected(exception);
  }
}

void Promise<void>::addOnResolvedListener(OnResolvedFunc&& onResolved) {
  std::unique_lock lock(_mutex);
  if (isResolved(lock)) {
    lock.unlock();
    onResolved();
  } else {
    _onResolvedListeners.push_back(std::move(onResolved));
  }
}
void Promise<void>::addOnResolvedListener(const OnResolvedFunc& onResolved) {
  std::unique_lock lock(_mutex);
  if (isResolved(lock)) {
    lock.unlock();
    onResolved();
  } else {
    _onResolvedListeners.push_back(onResolved);
  }
}
void Promise<void>::addOnRejectedListener(OnRejectedFunc&& onRejected) {
  std::unique_lock lock(_mutex);
  if (isRejected(lock)) {
    std::exception_ptr error = _error;
    lock.unlock();
    onRejected(error);
  } else {
    // Promise is not yet rejected, put the listener in our queue.
    _onRejectedListeners.push_back(std::move(onRejected));
  }
}
void Promise<void>::addOnRejectedListener(const OnRejectedFunc& onRejected) {
  std::unique_lock lock(_mutex);
  if (isRejected(lock)) {
    std::exception_ptr error = _error;
    lock.unlock();
    onRejected(error);
  } else {
    // Promise is not yet rejected, put the listener in our queue.
    _onRejectedListeners.push_back(onRejected);
  }
}

std::future<void> Promise<void>::await() {
  auto promise = std::make_shared<std::promise<void>>();
  addOnResolvedListener([promise]() { promise->set_value(); });
  addOnRejectedListener([promise](const std::exception_ptr& error) { promise->set_exception(error); });
  return promise->get_future();
}

const std::exception_ptr& Promise<void>::getError() const {
  std::unique_lock lock(_mutex);
  if (!isRejected(lock)) {
    throw std::runtime_error("Cannot get error when Promise<void> is not yet rejected!");
  }
  return _error;
}

} // namespace margelo::nitro
