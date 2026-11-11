//
//  JInstant.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 19.11.24.
//

#pragma once

#include <chrono>
#include <fbjni/fbjni.h>
#include <jni.h>

namespace margelo::nitro {

using namespace facebook;
using namespace std;

/**
 * Represents an `Instant` from Kotlin.
 */
struct JInstant final : public jni::JavaClass<JInstant> {
public:
  static constexpr auto kJavaDescriptor = "Ljava/time/Instant;";

public:
  static jni::local_ref<JInstant> ofEpochMilliseconds(jlong millisecondsSinceEpoch) {
    static const auto clazz = javaClassStatic();
    static const auto method = clazz->getStaticMethod<jni::local_ref<JInstant>(jlong)>("ofEpochMilli");
    return method(clazz, millisecondsSinceEpoch);
  }

  static jni::local_ref<JInstant> fromChrono(chrono::system_clock::time_point date) {
    auto timeSinceEpoch = date.time_since_epoch();
    long long milliseconds = chrono::duration_cast<chrono::milliseconds>(timeSinceEpoch).count();
    return JInstant::ofEpochMilliseconds(static_cast<jlong>(milliseconds));
  }

public:
  jlong toEpochMilliseconds() {
    static const auto clazz = javaClassStatic();
    const auto method = clazz->getMethod<jlong()>("toEpochMilli");
    return method(self());
  }

  chrono::system_clock::time_point toChrono() {
    jlong millisecondsSinceEpoch = toEpochMilliseconds();
    auto duration = chrono::duration<long, std::milli>(static_cast<long>(millisecondsSinceEpoch));
    auto date = chrono::system_clock::time_point(chrono::duration_cast<chrono::system_clock::duration>(duration));
    return date;
  }
};

} // namespace margelo::nitro
