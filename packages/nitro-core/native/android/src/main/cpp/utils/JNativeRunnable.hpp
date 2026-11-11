//
// Created by Marc Rousavy on 29.01.26.
//

#pragma once

#include "JRunnable.hpp"
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

class JNativeRunnable : public jni::HybridClass<JNativeRunnable, JRunnable> {
public:
  explicit JNativeRunnable(std::function<void()>&& func) : _func(std::move(func)) {}

  void run() {
    _func();
  }

public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/utils/NativeRunnable;";
  static void registerNatives() {
    registerHybrid({makeNativeMethod("run", JNativeRunnable::run)});
  }

private:
  friend HybridBase;
  std::function<void()> _func;
};

} // namespace margelo::nitro