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
};

} // namespace margelo::nitro
