#pragma once

#include <fbjni/fbjni.h>

namespace margelo::nitro {

namespace jni = facebook::jni;

/** Kotlin's boxed unsigned value. Its class and JNI entry points are kept by consumer-rules.pro. */
struct JULong : jni::JavaClass<JULong> {
  static constexpr auto kJavaDescriptor = "Lkotlin/ULong;";

  static jni::local_ref<JULong> valueOf(jlong value) {
    return newInstance(value);
  }
};

} // namespace margelo::nitro
