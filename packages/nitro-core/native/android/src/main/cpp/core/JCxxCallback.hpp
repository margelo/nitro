#pragma once

#include <NitroModules/BorrowingReference.hpp>
#include <NitroModules/Dispatcher.hpp>
#include <fbjni/fbjni.h>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <optional>

namespace margelo::nitro {

namespace jni = facebook::jni;

/**
 * A JS function and the Runtime and Dispatcher that call it.
 * JS functions are untyped, so callbacks of any signature can call the same one.
 */
struct JSCallbackFunction {
  std::reference_wrapper<jsi::Runtime> runtime;
  BorrowingReference<jsi::Function> function;
  std::weak_ptr<Dispatcher> dispatcher;
};

/**
 * The C++ part of the Kotlin `CxxCallback`, the base class of generated callback classes.
 *
 * Each module generates its own class for a callback signature. Through this base class,
 * a module calls the JS function of another module's callback with its own signature.
 */
class JCxxCallback : public jni::HybridClass<JCxxCallback> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/CxxCallback;";

  /** The JS function this callback calls, or `std::nullopt` if it calls a native function. */
  virtual std::optional<JSCallbackFunction> getJSFunction() const = 0;
};

} // namespace margelo::nitro
