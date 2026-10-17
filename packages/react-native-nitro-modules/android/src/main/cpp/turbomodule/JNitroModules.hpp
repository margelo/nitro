//
// Created by Marc Rousavy on 07.10.24.
//

#pragma once

#include <ReactCommon/BindingsInstallerHolder.h>
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

class JNitroModules final : public jni::JavaClass<JNitroModules> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/NitroModules;";

  static void registerNatives();

private:
  static jni::local_ref<react::BindingsInstallerHolder::javaobject> getBindingsInstaller(jni::alias_ref<JNitroModules::javaobject>);
};

} // namespace margelo::nitro
