//
//  JPromise.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "Promise.hpp"
#include <fbjni/fbjni.h>
#include <mutex>
#include <variant>

namespace margelo::nitro {

using namespace facebook;

struct JOnResolvedCallback : public jni::JavaClass<JOnResolvedCallback> {
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/Promise$OnResolvedCallback;";
  void onResolved(const jni::alias_ref<jni::JObject>& result) const {
    static const auto method = javaClassLocal()->getMethod<void(jni::alias_ref<jni::JObject>)>("onResolved");
    method(self(), result);
  }
};

struct JOnRejectedCallback : public jni::JavaClass<JOnRejectedCallback> {
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/Promise$OnRejectedCallback;";
  void onRejected(const jni::alias_ref<jni::JThrowable>& error) const {
    static const auto method = javaClassLocal()->getMethod<void(jni::alias_ref<jni::JThrowable>)>("onRejected");
    method(self(), error);
  }
};

/**
 * Represents a Promise implemented in Java.
 */
class JPromise final : public jni::HybridClass<JPromise> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/Promise;";
  using ResultType = jni::global_ref<jni::JObject>;
  using ErrorType = jni::global_ref<jni::JThrowable>;
  using OnResolvedFunc = std::function<void(jni::alias_ref<jni::JObject>)>;
  using OnRejectedFunc = std::function<void(jni::alias_ref<jni::JThrowable>)>;

private:
  /**
   * Create a new, still unresolved `JPromise` from Java.
   */
  static jni::local_ref<JPromise::jhybriddata> initHybrid(jni::alias_ref<jhybridobject>) {
    return makeCxxInstance();
  }

public:
  /**
   * Create a new, still unresolved `JPromise` from C++.
   */
  static jni::local_ref<JPromise::javaobject> create() {
    return newObjectCxxArgs();
  }

public:
  ~JPromise() override {
    if (isPending()) [[unlikely]] {
      jni::ThreadScope::WithClassLoader([&]() {
        std::runtime_error error("Timeouted: JPromise was destroyed!");
        this->reject(jni::getJavaExceptionForCppException(std::make_exception_ptr(error)));
      });
    }
  }

public:
  void resolve(jni::alias_ref<jni::JObject> result) {
    std::unique_lock lock(_mutex);
    jni::global_ref<jni::JObject> globalResult = jni::make_global(result);
    _state = globalResult;
    for (const auto& onResolved : _onResolvedListeners) {
      onResolved(result);
    }
  }
  void reject(jni::alias_ref<jni::JThrowable> error) {
    std::unique_lock lock(_mutex);
    jni::global_ref<jni::JThrowable> globalError = jni::make_global(error);
    _state = globalError;
    for (const auto& onRejected : _onRejectedListeners) {
      onRejected(error);
    }
  }

public:
  void addOnResolvedListener(OnResolvedFunc&& onResolved) {
    std::unique_lock lock(_mutex);
    if (auto result = std::get_if<ResultType>(&_state)) {
      // Promise is already resolved! Call the callback immediately
      onResolved(*result);
    } else {
      // Promise is not yet resolved, put the listener in our queue.
      _onResolvedListeners.push_back(std::move(onResolved));
    }
  }
  void addOnRejectedListener(OnRejectedFunc&& onRejected) {
    std::unique_lock lock(_mutex);
    if (auto error = std::get_if<ErrorType>(&_state)) {
      // Promise is already rejected! Call the callback immediately
      onRejected(*error);
    } else {
      // Promise is not yet rejected, put the listener in our queue.
      _onRejectedListeners.push_back(std::move(onRejected));
    }
  }

private:
  void addOnResolvedListenerJava(jni::alias_ref<JOnResolvedCallback> callback) {
    std::unique_lock lock(_mutex);
    if (auto result = std::get_if<ResultType>(&_state)) {
      // Promise is already resolved! Call the callback immediately
      callback->onResolved(*result);
    } else {
      // Promise is not yet resolved, put the listener in our queue.
      auto sharedCallback = jni::make_global(callback);
      _onResolvedListeners.emplace_back(
          [sharedCallback = std::move(sharedCallback)](const auto& result) { sharedCallback->onResolved(result); });
    }
  }
  void addOnRejectedListenerJava(jni::alias_ref<JOnRejectedCallback> callback) {
    std::unique_lock lock(_mutex);
    if (auto error = std::get_if<ErrorType>(&_state)) {
      // Promise is already rejected! Call the callback immediately
      callback->onRejected(*error);
    } else {
      // Promise is not yet rejected, put the listener in our queue.
      auto sharedCallback = jni::make_global(callback);
      _onRejectedListeners.emplace_back(
          [sharedCallback = std::move(sharedCallback)](const auto& error) { sharedCallback->onRejected(error); });
    }
  }

private:
  [[nodiscard]]
  bool isPending() const noexcept {
    return std::holds_alternative<std::monostate>(_state);
  }

private:
  JPromise() = default;

private:
  friend HybridBase;
  using HybridBase::HybridBase;
  std::variant<std::monostate, ResultType, ErrorType> _state;
  std::vector<OnResolvedFunc> _onResolvedListeners;
  std::vector<OnRejectedFunc> _onRejectedListeners;
  std::mutex _mutex;

public:
  static void registerNatives() {
    registerHybrid({
        makeNativeMethod("initHybrid", JPromise::initHybrid),
        makeNativeMethod("nativeResolve", JPromise::resolve),
        makeNativeMethod("nativeReject", JPromise::reject),
        makeNativeMethod("addOnResolvedListener", JPromise::addOnResolvedListenerJava),
        makeNativeMethod("addOnRejectedListener", JPromise::addOnRejectedListenerJava),
    });
  }
};

} // namespace margelo::nitro
