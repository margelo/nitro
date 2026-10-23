//
// Created by Marc Rousavy on 29.01.26.
//

#pragma once

#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

struct JRunnable : public jni::JavaClass<JRunnable> {
public:
  static constexpr auto kJavaDescriptor = "Ljava/lang/Runnable;";

public:
  void run() const {
    static const auto method = javaClassStatic()->getMethod<void()>("run");
    method(self());
  }
};

/**
 * Runs the given `Runnable` once and releases it, on any thread.
 * Attaches the current thread to the JVM only if it is not attached yet.
 * Errors thrown by the `Runnable` are reported to the `GlobalErrorHandler`.
 */
void runAndResetGlobalRef(jni::global_ref<JRunnable>& runnable) noexcept;

} // namespace margelo::nitro
