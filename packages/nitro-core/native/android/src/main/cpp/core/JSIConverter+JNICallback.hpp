#pragma once

#include "JNICallback.hpp"
#include "JTypedCallback.hpp"
#include <NitroModules/JSIConverter+Callback.hpp>

namespace margelo::nitro {

/** Converts a JS function to and from a Kotlin `Callback<...>`. */
template <typename JavaCallback>
struct JSIConverter<jni::local_ref<JTypedCallback<JavaCallback>>> final {
  using KotlinCallback = JTypedCallback<JavaCallback>;
  using NativeCallback = typename JavaCallback::HybridType::CallbackType;

  static jni::local_ref<KotlinCallback> fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    return KotlinCallback::create(JSIConverter<NativeCallback>::fromJSI(runtime, value));
  }
  static jsi::Value toJSI(jsi::Runtime& runtime, jni::alias_ref<KotlinCallback> value) {
    return JSIConverter<NativeCallback>::toJSI(runtime, value->getCallback());
  }
  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    return JSIConverter<NativeCallback>::canConvert(runtime, value);
  }
};

} // namespace margelo::nitro
