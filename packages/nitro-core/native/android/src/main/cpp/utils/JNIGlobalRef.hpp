#pragma once

#include <fbjni/fbjni.h>
#include <memory>
#include <utility>

namespace margelo::nitro {

namespace jni = facebook::jni;

/** Deletes a global reference on any thread, without entering an application classloader. */
template <typename T>
void resetGlobalRef(jni::global_ref<T>& reference) {
  if (jni::detail::currentOrNull() != nullptr) {
    reference.reset();
  } else if (reference) {
    jni::ThreadScope scope;
    reference.reset();
  }
}

/**
 * A global reference with shared ownership. Its last owner releases it on whichever thread that is,
 * e.g. Hermes' GC thread when it destroys a JS function or Promise that captured it.
 */
template <typename T>
using SharedGlobalRef = std::shared_ptr<const jni::global_ref<T>>;

/** Shares the given global reference, and releases it with `resetGlobalRef` once its last owner is gone. */
template <typename T>
SharedGlobalRef<T> makeSharedGlobalRef(jni::global_ref<T>&& reference) {
  return std::shared_ptr<jni::global_ref<T>>(new jni::global_ref<T>(std::move(reference)), [](jni::global_ref<T>* owned) {
    resetGlobalRef(*owned);
    delete owned;
  });
}

/**
 * Runs the given function, and attaches this thread to the JVM for it only if it is not attached yet.
 * Use this only where the JS engine picks the thread, e.g. when its GC destroys a pending Promise.
 */
template <typename Function>
void runAttached(Function&& function) {
  if (jni::detail::currentOrNull() != nullptr) {
    function();
  } else {
    // A thread the JVM did not create only sees app classes through the application classloader.
    jni::ThreadScope::WithClassLoader(std::forward<Function>(function));
  }
}

} // namespace margelo::nitro
