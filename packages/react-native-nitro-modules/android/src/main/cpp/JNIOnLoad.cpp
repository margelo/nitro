/// Entry point for JNI.

#include "JNitroModules.hpp"
#include "NitroOnLoad.hpp"
#include <fbjni/fbjni.h>
#include <jni.h>

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, [] {
    margelo::nitro::registerNatives();
    margelo::nitro::JNitroModules::registerNatives();
  });
}
