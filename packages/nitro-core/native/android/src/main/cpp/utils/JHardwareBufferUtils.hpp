//
//  JHardwareBufferUtils.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 11.07.25.
//

#pragma once

#include <android/hardware_buffer.h>
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

class JHardwareBufferUtils final : public jni::JavaClass<JHardwareBufferUtils> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/utils/HardwareBufferUtils;";

public:
  static size_t getHardwareBufferSize(AHardwareBuffer* hardwareBuffer);

  static void copyHardwareBufferBoxed(jni::alias_ref<jni::JClass>, jni::alias_ref<jni::JObject> boxedSourceHardwareBuffer,
                                      jni::alias_ref<jni::JObject> boxedDestinationHardwareBuffer);

  static jni::local_ref<jni::JObject> copyHardwareBufferBoxedNew(jni::alias_ref<jni::JClass>,
                                                                 jni::alias_ref<jni::JObject> boxedSourceHardwareBuffer);

  static void copyHardwareBuffer(AHardwareBuffer* sourceHardwareBuffer, AHardwareBuffer* destinationHardwareBuffer);

public:
  static void registerNatives() {
    javaClassStatic()->registerNatives({makeNativeMethod("copyHardwareBuffer", JHardwareBufferUtils::copyHardwareBufferBoxed),
                                        makeNativeMethod("copyHardwareBuffer", JHardwareBufferUtils::copyHardwareBufferBoxedNew)});
  }
};

} // namespace margelo::nitro
