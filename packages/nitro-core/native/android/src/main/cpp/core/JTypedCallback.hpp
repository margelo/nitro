#pragma once

#include "JCxxCallback.hpp"
#include <fbjni/fbjni.h>
#include <utility>

namespace margelo::nitro {

namespace jni = facebook::jni;

/**
 * A Kotlin `Callback<...>`, which JNI declares as nitro-core's `Callback` interface, with the callback
 * class generated for its signature retained at compile time. That class holds a C++ `Callback<...>`.
 */
template <typename JavaCallback>
struct JTypedCallback : jni::JavaClass<JTypedCallback<JavaCallback>> {
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/Callback;";

  /** Holds the C++ callback in a new instance of the generated callback class. */
  template <typename CallbackType>
  static jni::local_ref<JTypedCallback> create(CallbackType&& callback) {
    using CxxPart = typename JavaCallback::HybridType;
    jobject object = CxxPart::create(std::forward<CallbackType>(callback)).release();
    return jni::adopt_local(static_cast<typename JTypedCallback::javaobject>(object));
  }

  /**
   * The C++ callback of a generated callback class with this signature from any module,
   * or a new one that calls a callback implemented in Kotlin.
   */
  auto getCallback() const {
    using CxxPart = typename JavaCallback::HybridType;
    using CallbackType = typename CxxPart::CallbackType;
    if (this->isInstanceOf(JCxxCallback::javaClassStatic())) {
      jobject object = this->self();
      return CallbackType(CxxPart::getCallback(jni::wrap_alias(static_cast<JCxxCallback::javaobject>(object))));
    }
    return CallbackType(CxxPart::fromKotlin(this->self()));
  }
};

} // namespace margelo::nitro
