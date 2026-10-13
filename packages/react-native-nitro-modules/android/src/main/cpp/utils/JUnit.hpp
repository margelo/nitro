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
 * This is similar to `void` for Java, but is actually an `Object` (the `kotlin.Unit.INSTANCE` singleton).
 */
class JUnit final {
public:
  /**
   * Gets the shared instance to `Unit`. This is always a static global.
   */
  static jni::alias_ref<jni::JObject> instance() {
    static const auto clazz = jni::findClassStatic("kotlin/Unit");
    static const auto instanceField = clazz->getStaticField<jni::JObject>("INSTANCE", "Lkotlin/Unit;");
    static const jni::global_ref<jni::JObject> sharedInstance = jni::make_global(clazz->getStaticFieldValue(instanceField));
    return sharedInstance;
  }
};

} // namespace margelo::nitro
