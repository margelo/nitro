//
// Created by Marc Rousavy on 07.10.24.
//

#pragma once

#include <ReactCommon/CallInvoker.h>
#include <ReactCommon/CallInvokerHolder.h>
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>

namespace margelo::nitro {

using namespace facebook;

class JNitroModules final : public jni::HybridClass<JNitroModules> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/NitroModules;";

private:
  explicit JNitroModules() = default;

private:
  // JNI Methods
  static jni::local_ref<JNitroModules::jhybriddata> initHybrid(jni::alias_ref<jhybridobject> javaThis);
  void install(jlong runtimePointer, jni::alias_ref<react::CallInvokerHolder::javaobject> callInvokerHolder);

private:
  static constexpr auto TAG = "NitroModules";
  using HybridBase::HybridBase;
  friend HybridBase;

public:
  static void registerNatives();
};

} // namespace margelo::nitro
