#pragma once

#include <fbjni/fbjni.h>

namespace margelo::nitro {

namespace jni = facebook::jni;

/**
 * The Kotlin `GlobalErrorHandler`, which reports Kotlin errors to the C++ `GlobalErrorHandler`.
 */
struct JGlobalErrorHandler final : public jni::JavaClass<JGlobalErrorHandler> {
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/GlobalErrorHandler;";

  static void registerNatives();

private:
  static void reportNativeCallbackError(jni::alias_ref<jni::JClass>, jni::alias_ref<jni::JThrowable> error);
};

} // namespace margelo::nitro
