#include "JRunnable.hpp"
#include <NitroModules/GlobalErrorHandler.hpp>
#include <exception>

namespace margelo::nitro {

static void runAndReset(jni::global_ref<JRunnable>& runnable) noexcept {
  try {
    runnable->run();
  } catch (...) {
    GlobalErrorHandler::reportError(ErrorSource::NativeCallback, std::current_exception());
  }
  runnable.reset();
}

void runAndResetGlobalRef(jni::global_ref<JRunnable>& runnable) noexcept {
  if (!runnable) {
    return;
  }
  if (jni::detail::currentOrNull() != nullptr) {
    runAndReset(runnable);
  } else {
    // Hermes GC can destroy JS objects on a non-JNI Thread.
    jni::ThreadScope scope;
    runAndReset(runnable);
  }
}

} // namespace margelo::nitro
