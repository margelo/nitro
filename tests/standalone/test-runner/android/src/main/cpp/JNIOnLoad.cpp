#include "TestRuntime.hpp"
#include <fbjni/fbjni.h>
#include <jni.h>

namespace {
using namespace facebook;

class JNativeTestRuntime final : public jni::JavaClass<JNativeTestRuntime> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/testing/runner/NativeTestRuntime;";

  static jni::local_ref<jni::JString> runTest(jni::alias_ref<JNativeTestRuntime>, jni::alias_ref<jni::JString> bundle,
                                              jni::alias_ref<jni::JString> name, jint timeoutMs) {
    return jni::make_jstring(margelo::nitro::testing::runTest(bundle->toStdString(), name->toStdString(), timeoutMs));
  }

  static void registerNatives() {
    javaClassStatic()->registerNatives({makeNativeMethod("runTest", JNativeTestRuntime::runTest)});
  }
};
} // namespace

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, [] { JNativeTestRuntime::registerNatives(); });
}
