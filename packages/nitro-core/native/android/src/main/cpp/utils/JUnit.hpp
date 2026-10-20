//
//  JUnit.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 19.11.24.
//

#pragma once

#include "NitroDefines.hpp"
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents a `Unit` from Kotlin.
 * This is similar to `void` for Java, but is actually an `Object`.
 */
class JUnit final {
public:
  /**
   * Gets the shared instance to `Unit`. This is always a static global.
   */
  static jni::alias_ref<jni::JObject> instance() {
    static jni::global_ref<jni::JObject> sharedInstance = nullptr;
    if (sharedInstance == nullptr) {
      jni::alias_ref<jni::JClass> clazz = jni::findClassStatic("java/lang/Object");
      jni::JConstructor<jobject()> constructor = clazz->getConstructor<jobject()>();
      jni::local_ref<jobject> instance = clazz->newObject(constructor);
      sharedInstance = jni::make_global(instance);
    }
    return sharedInstance;
  }
};

} // namespace margelo::nitro
