//
//  PromiseHolder.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.08.24.
//

#pragma once

#include "NitroDefines.hpp"
#include "Promise.hpp"
#include <exception>
#include <memory>
#include <type_traits>

namespace margelo::nitro {

using namespace facebook;

/**
 * Holds instances of `std::shared_ptr<Promise<T>>`.
 * The reason this exists is for performance optimizations, as well as easier listeners for Swift.
 */
template <typename T>
class PromiseHolder final {
public:
  PromiseHolder(const std::shared_ptr<Promise<T>>& promise) : _promise(promise) {}
  PromiseHolder(std::shared_ptr<Promise<T>>&& promise) : _promise(std::move(promise)) {}

public:
  static PromiseHolder<T> create() {
    return PromiseHolder<T>(Promise<T>::create());
  }

public:
  void resolve(T value) const {
    _promise->resolve(std::move(value));
  }

  void reject(const std::exception_ptr& exception) const {
    _promise->reject(exception);
  }

public:
  void addOnResolvedListener(std::function<void(const T&)> onResolved) const {
    _promise->addOnResolvedListener([onResolved = std::move(onResolved)](const T& result) { onResolved(result); });
  }
  void addOnResolvedListenerCopy(std::function<void(T)> onResolved) const {
    _promise->addOnResolvedListener([onResolved = std::move(onResolved)](const T& result) { onResolved(result); });
  }

  void addOnRejectedListener(std::function<void(const std::exception_ptr&)> onRejected) const {
    _promise->addOnRejectedListener([onRejected = std::move(onRejected)](const std::exception_ptr& error) { onRejected(error); });
  }

private:
  std::shared_ptr<Promise<T>> _promise;
};

template <>
class PromiseHolder<void> final {
public:
  PromiseHolder(const std::shared_ptr<Promise<void>>& promise) : _promise(promise) {}
  PromiseHolder(std::shared_ptr<Promise<void>>&& promise) : _promise(std::move(promise)) {}

public:
  static PromiseHolder<void> create() {
    return PromiseHolder<void>(Promise<void>::create());
  }

public:
  void resolve() const {
    _promise->resolve();
  }

  void reject(const std::exception_ptr& exception) const {
    _promise->reject(exception);
  }

public:
  void addOnResolvedListener(std::function<void()> onResolved) const {
    _promise->addOnResolvedListener([onResolved = std::move(onResolved)]() { onResolved(); });
  }

  void addOnRejectedListener(std::function<void(const std::exception_ptr&)> onRejected) const {
    _promise->addOnRejectedListener([onRejected = std::move(onRejected)](const std::exception_ptr& error) { onRejected(error); });
  }

private:
  std::shared_ptr<Promise<void>> _promise;
};

} // namespace margelo::nitro
