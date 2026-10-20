//
//  InlineCallback.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 28.09.26.
//

#pragma once

#include <NitroModules/BorrowingReference.hpp>
#include <NitroModules/Callback.hpp>
#include <NitroModules/Dispatcher.hpp>
#include <NitroModules/JSICache.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <cassert>
#include <cstdlib>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <type_traits>
#include <utility>
#include <variant>

namespace margelo::nitro {

template <typename Signature>
class InlineCallback;

/**
 * A borrowed/inline Callback to either JS (`jsi::Function`) or native (`std::function`).
 *
 * `InlineCallback` is non-escapable, meaning it can only be called inline within the
 * scope of the calling function.
 */
template <typename R, typename... Args>
class SWIFT_NONCOPYABLE SWIFT_NONESCAPABLE InlineCallback<R(Args...)> final {
  friend JSIConverter<InlineCallback>;
  template <typename, typename>
  friend struct SwiftCallbackConverter;

  struct JSCallback;
  using NativeCallback = std::function<R(Args...)>;
public:
  // Swift only imports factories of non-escapable types with lifetime annotations.
  static InlineCallback make(jsi::Runtime& runtime [[clang::lifetimebound]], jsi::Function&& function) {
    return InlineCallback(JSCallback(runtime, std::move(function)));
  }
  static InlineCallback make(std::function<R(Args...)>&& function) SWIFT_RETURNS_INDEPENDENT_VALUE {
    return InlineCallback(std::move(function));
  }
public:
  InlineCallback(const InlineCallback&) = delete;
  InlineCallback(InlineCallback&&) {
    // TODO: We should delete the move constructor, but then Swift cannot import this type...
    assert(false && "Callback is non-movable!");
    std::abort();
  }
  ~InlineCallback() = default;
private:
  explicit InlineCallback(NativeCallback&& function): _impl(std::move(function)) {}
  explicit InlineCallback(JSCallback&& callback): _impl(std::move(callback)) {}

public:
  [[nodiscard]] R call(Args... args) const SWIFT_PRIVATE {
    if (auto* nativeCallback = std::get_if<NativeCallback>(&_impl)) {
      // It holds a native Callback (`std::function`)
      return (*nativeCallback)(std::forward<Args>(args)...);
    } else {
      // It holds a JS Callback (`jsi::Function`)
      return std::get<JSCallback>(_impl)(std::forward<Args>(args)...);
    }
  }

  // Copy the implementation so this inline callback remains usable.
  // TODO: Think about removing escape() const& in favor of only keeping escape() &&,
  //       or at least renaming it to escapeCopy() for explicitness
  [[nodiscard]] Callback<R(Args...)> escape() const & {
    if (auto* nativeCallback = std::get_if<NativeCallback>(&_impl)) {
      // It holds a native Callback (`std::function`)
      return Callback<R(Args...)>::make(*nativeCallback);
    } else {
      // It holds a JS Callback (`jsi::Function`)
      const auto& jsCallback = std::get<JSCallback>(_impl);
      jsi::Runtime& runtime = jsCallback._runtime;
      BorrowingReference<jsi::Function> function = jsCallback.escapeFunction();
      std::shared_ptr<Dispatcher> dispatcher = Dispatcher::getRuntimeGlobalDispatcher(runtime);
      return Callback<R(Args...)>::make(runtime, std::move(function), dispatcher);
    }
  }

  // Transfer the implementation. This inline callback must not be called afterward.
  [[nodiscard]] Callback<R(Args...)> escape() && {
    if (auto* nativeCallback = std::get_if<NativeCallback>(&_impl)) {
      return Callback<R(Args...)>::make(std::move(*nativeCallback));
    } else {
      auto& jsCallback = std::get<JSCallback>(_impl);
      jsi::Runtime& runtime = jsCallback._runtime;
      BorrowingReference<jsi::Function> function = std::move(jsCallback).escapeFunction();
      std::shared_ptr<Dispatcher> dispatcher = Dispatcher::getRuntimeGlobalDispatcher(runtime);
      return Callback<R(Args...)>::make(runtime, std::move(function), dispatcher);
    }
  }

private:
  struct JSCallback {
    friend InlineCallback;
    friend JSIConverter<InlineCallback>;
    template <typename, typename>
    friend struct SwiftCallbackConverter;

  public:
    JSCallback(jsi::Runtime& runtime, jsi::Function&& function): _runtime(runtime), _function(std::move(function)) { }
    R operator()(Args&&... args) const {
      if constexpr (std::is_void_v<R>) {
        _function.call(_runtime, JSIConverter<std::decay_t<Args>>::toJSI(_runtime, std::forward<Args>(args))...);
      } else {
        jsi::Value result = _function.call(_runtime, JSIConverter<std::decay_t<Args>>::toJSI(_runtime, std::forward<Args>(args))...);
        return JSIConverter<R>::fromJSI(_runtime, result);
      }
    }

    [[nodiscard]]
    BorrowingReference<jsi::Function> escapeFunction() const & {
      jsi::Function copiedFunction = jsi::Value(_runtime, _function).getObject(_runtime).getFunction(_runtime);
      JSICache& cache = JSICache::getOrCreateCache(_runtime);
      return cache.makeShared(std::move(copiedFunction));
    }
    [[nodiscard]]
    BorrowingReference<jsi::Function> escapeFunction() && {
      JSICache& cache = JSICache::getOrCreateCache(_runtime);
      return cache.makeShared(std::move(_function));
    }
  private:
    jsi::Runtime& _runtime;
    jsi::Function _function;
  };
  std::variant<NativeCallback, JSCallback> _impl;
};

} // namespace margelo::nitro
