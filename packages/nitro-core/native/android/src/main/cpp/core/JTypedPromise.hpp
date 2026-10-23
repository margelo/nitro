#pragma once

#include "JNIGlobalRef.hpp"
#include "JPromise.hpp"

namespace margelo::nitro {

/** A Promise's erased JVM class with its JNI result type retained at compile time. */
template <typename JNIResult>
struct JTypedPromise : jni::JavaClass<JTypedPromise<JNIResult>, JPromise::JavaPart> {
  static constexpr auto kJavaDescriptor = JPromise::kJavaDescriptor;

  static jni::local_ref<JTypedPromise> create() {
    auto promise = JPromise::create();
    auto raw = promise.release();
    auto object = static_cast<typename JTypedPromise::javaobject>(raw);
    return jni::adopt_local(object);
  }
};

namespace detail {
  template <typename JNIResult>
  struct JNIPromiseResult;

  template <typename T>
  struct JNIPromiseResult<jni::local_ref<T>> {
    using JavaClass = T;
    // A Promise's state can be destroyed on any thread, e.g. by Hermes' GC thread.
    using Stored = SharedGlobalRef<T>;
  };

  template <>
  struct JNIPromiseResult<void> {
    using Stored = void;
  };
} // namespace detail

} // namespace margelo::nitro
