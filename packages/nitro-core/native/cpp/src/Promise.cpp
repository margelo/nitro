//
//  Promise.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 18.11.24.
//

#include <NitroModules/Promise.hpp>

namespace margelo::nitro {
  
  Promise<void>::Promise(): _state(std::make_shared<State>()) { }

  Promise<void> Promise<void>::async(std::function<void()>&& run) {
    auto promise = pending();
    ThreadPool::shared().run([run = std::move(run), promise]() {
      try {
        run();
        promise.resolve();
      } catch (...) {
        promise.reject(std::current_exception());
      }
    });
    return promise;
  }

  Promise<void> Promise<void>::awaitFuture(std::future<void>&& future) {
    auto sharedFuture = std::make_shared<std::future<void>>(std::move(future));
    return async([sharedFuture = std::move(sharedFuture)]() { sharedFuture->get(); });
  }

  Promise<void>::State::~State() {
    if (!isResolved && !error) {
      Logger::log(LogLevel::Warning, "Promise", "Promise<void> was destroyed while it's still pending - it's now dangling!");
      error = std::make_exception_ptr(std::runtime_error("Timeouted! Promise<void> was destroyed in native."));
      for (const auto& listener : onRejectedListeners) {
        listener(error);
      }
    }
  }

  void Promise<void>::resolve() const {
    // Keep the state alive even if a listener destroys this Promise.
    const auto state = _state;
    std::unique_lock lock(state->mutex);
    assert(!state->isResolved && "Promise<void> cannot be resolved twice!");
    assert(!state->error && "Promise<void> cannot be resolved when it already has been rejected!");
    state->isResolved = true;
    auto listeners = std::move(state->onResolvedListeners);
    auto dropped = std::move(state->onRejectedListeners);

    lock.unlock();
    for (const auto& onResolved : listeners) {
      onResolved();
    }
  }
  
  void Promise<void>::reject(TError&& error) const {
    if (error == nullptr) [[unlikely]] {
      throw std::runtime_error("Cannot reject Promise<void> with a null exception_ptr!");
    }

    // Keep the state alive even if a listener destroys this Promise.
    const auto state = _state;
    std::unique_lock lock(state->mutex);
    assert(!state->error && "Promise<void> cannot be rejected twice!");
    assert(!state->isResolved && "Promise<void> cannot be reject when it already has been resolved!");
    state->error = std::move(error);
    auto listeners = std::move(state->onRejectedListeners);
    auto dropped = std::move(state->onResolvedListeners);
    const TError& rejected = state->error;

    lock.unlock();
    for (const auto& onRejected : listeners) {
      onRejected(rejected);
    }
  }
  
void Promise<void>::addOnResolvedListener(OnResolvedFunc onResolved) const {
  std::unique_lock lock(_state->mutex);
  if (_state->isResolved) {
    // It's already resolved - call callback now
    lock.unlock();
    onResolved();
  } else if (_state->error) {
    // It's already rejected - just drop the callback and ignore.
  } else {
    // It's pending - let's queue the callback for later
    _state->onResolvedListeners.push_back(std::move(onResolved));
  }
}
  
void Promise<void>::addOnRejectedListener(OnRejectedFunc onRejected) const {
  std::unique_lock lock(_state->mutex);
  if (_state->error) {
    // It's already rejected - call callback now
    const auto state = _state;
    lock.unlock();
    onRejected(state->error);
  } else if (_state->isResolved) {
    // It's already rejected - just drop the callback and ignore.
  } else {
    // It's pending - let's queue the callback for later
    _state->onRejectedListeners.push_back(std::move(onRejected));
  }
}

std::future<void> Promise<void>::await() const {
  auto promise = std::make_shared<std::promise<void>>();
  auto future = promise->get_future();
  addOnResolvedListener([promise]() { promise->set_value(); });
  addOnRejectedListener([promise](const TError& error) { promise->set_exception(error); });
  return future;
}

[[nodiscard]]
bool Promise<void>::isPending() const {
  std::unique_lock lock(_state->mutex);
  return !_state->isResolved && !_state->error;
}

[[nodiscard]]
bool Promise<void>::isResolved() const {
  std::unique_lock lock(_state->mutex);
  return _state->isResolved;
}

[[nodiscard]]
const Promise<void>::TError* Promise<void>::getErrorOrNull() const {
  std::unique_lock lock(_state->mutex);
  if (_state->error) {
    return &(_state->error);
  } else {
    return nullptr;
  }
}

} // namespace margelo::nitro
