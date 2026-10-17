//
// Created by Hanno Gödecke on 09.05.2025.
//

#pragma once

#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

/**
 * C++ counterpart for the StateWrapper java class which is exposed in the fabric view manager implementation.
 * Internally fabric is using StateWrapperImpl.kt but this class is hidden.
 * We thus pass the StateWrapper typed object to the native side and on the c++ side we can cast it to a StateWrapperImpl type.
 */
struct JStateWrapper : public jni::JavaClass<JStateWrapper> {
  static constexpr auto kJavaDescriptor = "Lcom/facebook/react/uimanager/StateWrapper;";
};

} // namespace margelo::nitro
