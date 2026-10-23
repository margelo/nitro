#pragma once

#include "JNICallback.hpp"
#include <NitroModules/JSIConverter+Callback.hpp>

namespace margelo::nitro {

/** Converts a JS function to and from a generated Kotlin callback class. */
template <typename JavaCallback>
  requires requires { typename JavaCallback::HybridType::NativeSignature; }
struct JSIConverter<jni::local_ref<JavaCallback>> final {
  using CxxPart = typename JavaCallback::HybridType;
  using NativeCallback = Callback<typename CxxPart::NativeSignature>;

  static jni::local_ref<JavaCallback> fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    NativeCallback callback = JSIConverter<NativeCallback>::fromJSI(runtime, value);
    return CxxPart::create(std::move(callback));
  }
  static jsi::Value toJSI(jsi::Runtime& runtime, jni::alias_ref<JavaCallback> value) {
    return JSIConverter<NativeCallback>::toJSI(runtime, getJNICallback<JavaCallback>(value));
  }
  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    return JSIConverter<NativeCallback>::canConvert(runtime, value);
  }
};

} // namespace margelo::nitro
