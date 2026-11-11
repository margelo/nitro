//
//  JNICallable.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 20.11.25.
//

#pragma once

#include "NitroDefines.hpp"
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

// Signature = R(Args...)
template <typename JFunc, typename Signature>
class JNICallable;

/**
 * A wrapper for any jni::JavaClass that implements `R invoke(Args...)` to
 * make it callable (e.g. conformable to `std::function<R(Args...)>`)
 * The `jni::global_ref` is safely deleted.
 */
template <typename JFunc, typename R, typename... Args>
class JNICallable<JFunc, R(Args...)> final {
public:
  using Signature = R(Args...);

  explicit JNICallable(jni::global_ref<JFunc>&& func) : _func(std::move(func)) {}
  ~JNICallable() {
    // Hermes GC can destroy JS objects on a non-JNI Thread.
    jni::ThreadScope::WithClassLoader([&] { _func.reset(); });
  }

public:
  inline R operator()(Args... args) const {
    if constexpr (std::is_void_v<R>) {
      _func->invoke(std::forward<Args>(args)...);
    } else {
      return _func->invoke(std::forward<Args>(args)...);
    }
  }

private:
  jni::global_ref<JFunc> _func;
};

} // namespace margelo::nitro
