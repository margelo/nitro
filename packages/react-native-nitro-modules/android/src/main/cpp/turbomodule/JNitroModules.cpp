//
// Created by Marc Rousavy on 07.10.24.
//

#include "JNitroModules.hpp"
#include "CallInvokerDispatcher.hpp"
#include "InstallNitro.hpp"

#include <exception>

namespace margelo::nitro {

jni::local_ref<JNitroModules::jhybriddata> JNitroModules::initHybrid(jni::alias_ref<JNitroModules::jhybridobject>) {
  return makeCxxInstance();
}

void JNitroModules::install(jlong runtimePointer, jni::alias_ref<react::CallInvokerHolder::javaobject> callInvokerHolder) {
  auto runtime = reinterpret_cast<jsi::Runtime*>(runtimePointer);
  if (runtime == nullptr) {
    throw std::invalid_argument("jsi::Runtime was null!");
  }

  if (callInvokerHolder == nullptr) {
    throw std::invalid_argument("CallInvokerHolder was null!");
  }
  auto callInvoker = callInvokerHolder->cthis()->getCallInvoker();
  if (callInvoker == nullptr) {
    throw std::invalid_argument("CallInvoker was null!");
  }

  auto dispatcher = std::make_shared<CallInvokerDispatcher>(callInvoker);
  margelo::nitro::install(*runtime, dispatcher);
}

void JNitroModules::registerNatives() {
  registerHybrid({makeNativeMethod("initHybrid", JNitroModules::initHybrid), makeNativeMethod("install", JNitroModules::install)});
}

} // namespace margelo::nitro
