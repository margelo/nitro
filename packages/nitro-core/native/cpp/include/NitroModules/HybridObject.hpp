//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include <NitroModules/BorrowingReference.hpp>
#include <NitroModules/HybridClass.hpp>

#include <NitroModules/NitroDefines.hpp>
#include <jsi/jsi.h>
#include <memory>
#include <type_traits>
#include <unordered_map>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents a C++ object that is exposed to JS.
 * `HybridObject`s can have native getters and setters, and normal methods.
 *
 * Generated specifications and Swift bridges declare a nested `Class` and override `getHybridClass`.
 * The descriptor registers member pointers, while each JavaScript instance holds this object's NativeState.
 *
 * The new class can then be passed to JS using the `JSIConverter<HybridObject>`.
 */
class HybridObject : public virtual jsi::NativeState, public std::enable_shared_from_this<HybridObject> {
public:
  /**
   * Describes this HybridObject's JavaScript class.
   *
   * get() returns an immutable HybridClass describing instance methods, properties,
   * the constructor, static methods, name, and base class.
   * HybridClass materializes the constructor and instance prototype together per Runtime.
   *
   * Accessing this metadata never constructs a HybridObject instance. Class bindings
   * can use it for construction, static methods, and instanceof without an instance.
   *
   * Each generated spec or Swift bridge declares its own Class with a JavaScript `name` and its
   * `Base` class's Class, and overrides getHybridClass() to return Class::get().
   * A Class does not inherit its base's Class, so leaving out `name` or `Base` fails to compile.
   * Concrete native implementations inherit the Class of their generated spec or bridge.
   */
  struct Class {
    using Base = void;
    static constexpr const char* name = "HybridObject";
    static const std::shared_ptr<const HybridClass>& get();
  };

public:
  /**
   * Create a new instance of a `HybridObject`.
   * Its name and bindings come from the shared HybridClass descriptor.
   */
  HybridObject();
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
  /** Return the shared type descriptor used to expose this object to JavaScript. */
  virtual const std::shared_ptr<const HybridClass>& getHybridClass() {
    return Class::get();
  }

private:
  std::unordered_map<jsi::Runtime*, BorrowingReference<jsi::WeakObject>> _objectCache;
};

} // namespace margelo::nitro
