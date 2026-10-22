#pragma once

#include <cstring>
#include <fbjni/fbjni.h>
#include <typeinfo>

namespace margelo::nitro {

namespace jni = facebook::jni;

/**
 * The C++ part of the Kotlin `CxxCallback`, the base class of generated callback classes.
 *
 * Each module generates its own class for a callback signature, so a callback from
 * another module is matched by the type of its C++ `Callback` instead of its class.
 */
class JCxxCallback : public jni::HybridClass<JCxxCallback> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/CxxCallback;";

  /** The held callback, or `nullptr` if it is not a `CallbackType`. */
  template <typename CallbackType>
  const CallbackType* getCallbackAs() const {
    // The NDK's libc++ compares type info by address, but each module's library has its own copy of it for
    // template instances such as `Callback<void(double)>`. Compare the mangled names instead, like libc++
    // does on platforms without unique type info.
    if (std::strcmp(getCallbackType().name(), typeid(CallbackType).name()) != 0) {
      return nullptr;
    }
    return static_cast<const CallbackType*>(getCallbackPointer());
  }

protected:
  virtual const std::type_info& getCallbackType() const = 0;
  virtual const void* getCallbackPointer() const = 0;
};

} // namespace margelo::nitro
