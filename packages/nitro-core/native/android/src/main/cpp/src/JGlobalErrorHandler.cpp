#include "JGlobalErrorHandler.hpp"
#include "JNIConverter+Error.hpp"
#include <NitroModules/GlobalErrorHandler.hpp>
#include <stdexcept>

namespace margelo::nitro {

static ErrorSource getErrorSource(jint source) {
  // These values match ErrorSource.nativeValue in Kotlin, independently of either enum's order.
  switch (source) {
    case 0:
      return ErrorSource::JSCallback;
    case 1:
      return ErrorSource::NativeCallback;
    case 2:
      return ErrorSource::Microtask;
    case 3:
      return ErrorSource::Timer;
    case 4:
      return ErrorSource::AnimationFrame;
    case 5:
      return ErrorSource::UICallback;
    default:
      throw std::invalid_argument("Unknown GlobalErrorHandler error source.");
  }
}

void JGlobalErrorHandler::reportError(jni::alias_ref<jni::JClass>, jint source, jni::alias_ref<jni::JThrowable> error) {
  ErrorSource errorSource = getErrorSource(source);
  std::exception_ptr exception = JNIConverter<std::exception_ptr, jni::local_ref<jni::JThrowable>>::fromJNI(error);
  GlobalErrorHandler::reportError(errorSource, std::move(exception));
}

void JGlobalErrorHandler::registerNatives() {
  javaClassStatic()->registerNatives({makeNativeMethod("reportError", JGlobalErrorHandler::reportError)});
}

} // namespace margelo::nitro
