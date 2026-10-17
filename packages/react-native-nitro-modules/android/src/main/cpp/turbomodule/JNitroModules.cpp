//
// Created by Marc Rousavy on 07.10.24.
//

#include "JNitroModules.hpp"
#include "CallInvokerDispatcher.hpp"
#include "InstallNitro.hpp"

namespace margelo::nitro {

jni::local_ref<react::BindingsInstallerHolder::javaobject> JNitroModules::getBindingsInstaller(jni::alias_ref<JNitroModules::javaobject>) {
  return react::BindingsInstallerHolder::newObjectCxxArgs([](jsi::Runtime& runtime, const std::shared_ptr<react::CallInvoker>& invoker) {
    auto dispatcher = std::make_shared<CallInvokerDispatcher>(invoker);
    margelo::nitro::install(runtime, dispatcher);
  });
}

void JNitroModules::registerNatives() {
  javaClassStatic()->registerNatives({makeNativeMethod("getBindingsInstaller", JNitroModules::getBindingsInstaller)});
}

} // namespace margelo::nitro
