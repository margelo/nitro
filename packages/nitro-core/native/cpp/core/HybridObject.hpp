//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include "HybridObjectPrototype.hpp"

#include "NitroDefines.hpp"
#include <jsi/jsi.h>
#include <memory>
#include <type_traits>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents a C++ object that is exposed to JS.
 * `HybridObject`s can have native getters and setters, and normal methods.
 *
 * To implement a `HybridObject`, simply inherit from this class and override `loadHybridMethods`
 * to register the given getters, setters or methods.
 *
 * The new class can then be passed to JS using the `JSIConverter<HybridObject>`.
 */
class HybridObject : public virtual jsi::NativeState, public HybridObjectPrototype, public std::enable_shared_from_this<HybridObject> {
public:
  /**
   * Create a new instance of a `HybridObject`.
   * The given `name` will be used for logging and stringifying.
   */
  explicit HybridObject(const char* NON_NULL name);
  /**
   * Called when no more references to the given `HybridObject` exist in both C++ and JS.
   * JS might keep references for longer, as it is a garbage collected language.
   */
  ~HybridObject() override;
  /**
   * HybridObjects cannot be copied.
   */
  HybridObject(const HybridObject& copy) = delete;
  /**
   * HybridObjects cannot be moved.
   */
  HybridObject(HybridObject&& move) = delete;
  /**
   * HybridObjects cannot be default-constructed!
   * Use this instead;
   * ```cpp
   * MyHybridObject(): HybridObject(TAG) {}
   * ```
   */
  HybridObject() {
    throw std::runtime_error("Cannot default-construct HybridObject! "
                             "Did you forget to add the `HybridObject(TAG)` base-constructor call to your Hybrid Object's constructor?");
  }

public:
  /**
   * Return the `jsi::Object` that holds this `HybridObject`. (boxed in a `jsi::Value`)
   * This properly assigns (or creates) the base prototype for this type,
   * and assigns its NativeState.
   * Additionally, this sets the external memory pressure for proper GC memory management.
   */
  jsi::Value toObject(jsi::Runtime& runtime);

public:
  /**
   * Get the `std::shared_ptr` instance of this HybridObject as its concrete type.
   * The HybridObject must be managed inside a `shared_ptr` already, otherwise this will fail.
   */
  template <typename Derived>
  std::shared_ptr<Derived> shared_cast() {
    return std::dynamic_pointer_cast<Derived>(shared());
  }
  /**
   * Get the `std::shared_ptr` instance of this HybridObject.
   */
  virtual std::shared_ptr<HybridObject> shared();

public:
  /**
   * Get the HybridObject's name
   */
  std::string getName();
  /**
   * Compare this HybridObject for reference equality to the other HybridObject.
   *
   * While two `jsi::Object`s of the same `HybridObject` might not be equal when compared with `==`,
   * they might still be the same `HybridObject` - in this case `equals(other)` will return true.
   */
  virtual bool equals(const std::shared_ptr<HybridObject>& other);
  /**
   * Get a string representation of this `HybridObject` - useful for logging or debugging.
   */
  virtual std::string toString();
  /**
   * Eagerly- (and manually-) dispose all native resources this `HybridObject` holds.
   * This method can only be manually called from JS using `dispose()`.
   *
   * If this method is never manually called, a `HybridObject` is expected to disposes its
   * resources as usual via the object's destructor (`~HybridObject()`, `deinit` or `finalize()`).
   *
   * By default, this method does nothing. It can be overridden to perform actual disposing/cleanup
   * if required.
   */
  virtual void dispose() {}

private:
  /**
   * The actual `dispose()` function from JS.
   * This needs to be a raw JSI function as we remove the NativeState here.
   */
  jsi::Value disposeRaw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* NON_NULL args, size_t count);

protected:
  /**
   * Get the size of any external (heap) allocations this `HybridObject` has made, in bytes.
   * This will be used to notify the JS GC about memory pressure.
   */
  virtual inline size_t getExternalMemorySize() noexcept {
    return 0;
  }

protected:
  /**
   * Loads all native methods of this `HybridObject` to be exposed to JavaScript.
   * The base implementation registers a `toString()` method and `name` property.
   *
   * Example:
   *
   * ```cpp
   * int User::getAge() {
   *   return 23;
   * }
   *
   * void User::loadHybridMethods() {
   *   HybridObject::loadHybridMethods();
   *   registerHybridMethod("getAge", &User::getAge);
   * }
   * ```
   */
  virtual void loadHybridMethods() override;

private:
  static constexpr auto TAG = "HybridObject";
  const char* NON_NULL _name = TAG;
  std::unordered_map<jsi::Runtime*, BorrowingReference<jsi::WeakObject>> _objectCache;
};

} // namespace margelo::nitro
