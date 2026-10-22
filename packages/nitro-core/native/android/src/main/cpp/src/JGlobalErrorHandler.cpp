#include "JGlobalErrorHandler.hpp"
#include "JNIConverter+Error.hpp"
#include <NitroModules/GlobalErrorHandler.hpp>

namespace margelo::nitro {

void JGlobalErrorHandler::reportNativeCallbackError(jni::alias_ref<jni::JClass>, jni::alias_ref<jni::JThrowable> error) {
  std::exception_ptr exception = JNIConverter<std::exception_ptr, jni::local_ref<jni::JThrowable>>::fromJNI(error);
  GlobalErrorHandler::reportError(ErrorSource::NativeCallback, std::move(exception));
}

void JGlobalErrorHandler::registerNatives() {
  javaClassStatic()->registerNatives({makeNativeMethod("reportNativeCallbackError", JGlobalErrorHandler::reportNativeCallbackError)});
}

} // namespace margelo::nitro
