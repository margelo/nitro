//
//  HybridObjectPrototype.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 07.08.24.
//

#pragma once

#include "BorrowingReference.hpp"
#include "HybridFunction.hpp"
#include "NitroDefines.hpp"
#include "Prototype.hpp"
#include "PrototypeChain.hpp"
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <string>
#include <type_traits>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents a Hybrid Object's prototype.
 * The prototype should be cached per Runtime, and can be assigned to multiple jsi::Objects.
 * When assigned to a jsi::Object, all methods of this prototype can be called on that jsi::Object,
 * as long as it has a valid NativeState (`this`).
 */
class HybridObjectPrototype {
public:
  HybridObjectPrototype() {}

public:
  /**
   * Get a fully initialized jsi::Object that represents this prototype to JS.
   * The result of this value will be cached per Runtime, so it's safe to call this often.
   */
  jsi::Value getPrototype(jsi::Runtime& runtime);

private:
  static jsi::Value createPrototype(jsi::Runtime& runtime, const std::shared_ptr<Prototype>& prototype);
  using PrototypeCache = std::unordered_map<NativeInstanceId, BorrowingReference<jsi::Object>>;
  static std::unordered_map<jsi::Runtime * NON_NULL, PrototypeCache> _prototypeCache;

protected:
  /**
   * Loads all Hybrid Methods that will be initialized in this Prototype.
   * This will only be called once for the first time the Prototype will be created,
   * so don't conditionally register methods.
   */
  virtual void loadHybridMethods() = 0;

private:
  /**
   * Ensures that all Hybrid Methods, Getters and Setters are initialized by calling loadHybridMethods().
   */
  void ensureInitialized();

private:
  PrototypeChain _prototypeChain;
  volatile bool _didLoadMethods = false;
  static constexpr auto TAG = "HybridObjectPrototype";

protected:
  using RegisterFn = void (*NON_NULL)(Prototype&);
  /**
   * Registers the given methods inside the Hybrid Object's prototype.
   *
   * For subsequent HybridObjects of the same type, `registerFunc` will not be called again, as the
   * prototype will already be known and cached.
   * **Do not conditionally register hybrid methods, getters or setter!**
   */
  template <typename Derived>
  inline void registerHybrids(Derived* NON_NULL /* this */, RegisterFn registerFunc) {
    const std::shared_ptr<Prototype>& prototype = _prototypeChain.extendPrototype<Derived>();

    if (!prototype->hasHybrids()) {
      // The `Prototype` does not have any methods or properties registered yet - so do it now
      registerFunc(*prototype);
    }
  }
};

} // namespace margelo::nitro
