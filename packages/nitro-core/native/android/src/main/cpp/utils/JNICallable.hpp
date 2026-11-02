//
//  JNICallable.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 20.11.25.
//

#pragma once

#include "JNIGlobalRef.hpp"
#include <NitroModules/NitroDefines.hpp>
#include <fbjni/fbjni.h>
#include <memory>

namespace margelo::nitro {

namespace jni = facebook::jni;

// Signature = R(Args...)
template <typename JFunc, typename Signature>
class JNICallable;

/**
 * A wrapper for any jni::JavaClass that implements `R invoke(Args...)` to
 * make it callable (e.g. conformable to `std::function<R(Args...)>`)
 * Calls require an attached thread. The last copy can be destroyed on any thread,
 * e.g. by Hermes' GC thread when it destroys a JS function that holds this callable.
 */
template <typename JFunc, typename R, typename... Args>
class JNICallable<JFunc, R(Args...)> final {
public:
  using Signature = R(Args...);

  explicit JNICallable(jni::global_ref<JFunc>&& func) : _func(makeSharedGlobalRef(std::move(func))) {}

public:
  inline R operator()(Args... args) const {
    // Invocation can reentrantly release this callable's owner.
    const auto func = _func;
    return (*func)->invoke(std::forward<Args>(args)...);
  }

private:
  SharedGlobalRef<JFunc> _func;
};

} // namespace margelo::nitro
