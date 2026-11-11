//
//  JNull.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 10.11.25
//

#pragma once

#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents a `Null` from Kotlin.
 */
struct JNull final : public jni::JavaClass<JNull> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/NullType;";

public:
  static jni::global_ref<JNull> null() {
    static const auto clazz = javaClassStatic();
    static const auto nullField = clazz->getStaticField<JNull>("NULL");
    static const auto nullValue = clazz->getStaticFieldValue(nullField);
    static const auto globalNullValue = jni::make_global(nullValue);
    return globalNullValue;
  }
};

} // namespace margelo::nitro
