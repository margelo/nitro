#pragma once

#include <fbjni/fbjni.h>
#include <typeinfo>

namespace margelo::nitro {

namespace jni = facebook::jni;

/**
 * The C++ part of the Kotlin `CxxCallback`, the base class of generated callback classes.
 * See `JNICallback<Signature>`, which every generated class derives from.
 */
class JCxxCallback : public jni::HybridClass<JCxxCallback> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/CxxCallback;";

  /** The type of the held `Callback<...>`, which debug builds check before using it. */
  virtual const std::type_info& getCallbackType() const = 0;
};

} // namespace margelo::nitro
