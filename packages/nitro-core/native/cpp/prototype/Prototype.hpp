//
//  PrototypeChain.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 07.08.24.
//

#pragma once

#include "HybridFunction.hpp"
#include <memory>
#include <string>
#include <typeindex>
#include <unordered_map>

namespace margelo::nitro {

/**
 * Represents a Prototype's native C++ type ID.
 * This can be used to identify a prototype against a C++ instance,
 * or used as a cache-key.
 */
using NativeInstanceId = std::type_index;

/**
 * Represents a JS `Prototype`'s structure.
 * Every prototype has a related C++ type ID (`instanceTypeId`).
 * Prototypes can be sub-classes, in which case they have a `base` prototype.
 * Each prototype has a list of methods, and properties (getters + setters).
 *
 * By using this `Prototype` structure, we can create JS objects that act
 * as prototypes for `HybridObject`s.
 *
 * While a `Prototype` actually holds all the methods, a `HybridObject` only
 * contains state and memory.
 * This way the JS VM doesn't need to re-create methods for each `HybridObject`,
 * they are only initialized once on the shared `Prototype`.
 */
struct Prototype final {
private:
  NativeInstanceId _instanceTypeId;
  std::shared_ptr<Prototype> _base = nullptr;
  std::unordered_map<std::string, HybridFunction> _methods;
  std::unordered_map<std::string, HybridFunction> _getters;
  std::unordered_map<std::string, HybridFunction> _setters;

private:
  Prototype(const NativeInstanceId& typeId, const std::shared_ptr<Prototype>& base) : _instanceTypeId(typeId), _base(base) {}

public:
  /**
   * Gets a `Prototype` specification/node for the given native C++ type ID.
   *
   * If the given C++ type ID is unknown, a new `Prototype` node is created,
   * which has to be initialized with methods, getters and setters first.
   *
   * If the given C++ type ID is already known in the static `Prototype` tree,
   * a shared reference to it is returned.
   */
  static std::shared_ptr<Prototype> get(const NativeInstanceId& typeId, const std::shared_ptr<Prototype>& base = nullptr) {
    static std::unordered_map<NativeInstanceId, std::shared_ptr<Prototype>> _prototypesCache;

    auto [it, inserted] = _prototypesCache.try_emplace(typeId);
    if (inserted) {
      // This is the first time we see this C++ type ID - create a new base Prototype for this.
      it->second = std::shared_ptr<Prototype>(new Prototype(typeId, base));
    }
    return it->second;
  }

public:
  template <typename T>
  inline bool isNativeInstance() const noexcept {
    return _instanceTypeId == std::type_index(typeid(T));
  }

  inline bool hasHybrids() const {
    return !_methods.empty() || !_getters.empty() || !_setters.empty();
  }

  inline bool hasBase() const noexcept {
    return _base != nullptr;
  }
  inline const std::shared_ptr<Prototype>& getBase() const noexcept {
    return _base;
  }
  inline const NativeInstanceId& getNativeInstanceId() const noexcept {
    return _instanceTypeId;
  }
  inline const std::unordered_map<std::string, HybridFunction>& getMethods() const noexcept {
    return _methods;
  }
  inline const std::unordered_map<std::string, HybridFunction>& getGetters() const noexcept {
    return _getters;
  }
  inline const std::unordered_map<std::string, HybridFunction>& getSetters() const noexcept {
    return _setters;
  }

public:
  /**
   * Registers the given C++ method as a property getter that can be called from JS, through the object's Prototype.
   * Example:
   * ```cpp
   * registerHybridGetter("foo", &MyObject::getFoo);
   * ```
   */
  template <typename Derived, typename ReturnType>
  inline void registerHybridGetter(std::string name, InstanceMethod<Derived, ReturnType> method) {
    if (_getters.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Property Getter \"" + name + "\" - a getter with that name already exists!");
    }
    if (_methods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Property Getter \"" + name + "\" - a method with that name already exists!");
    }

    _getters.emplace(name, HybridFunction::createHybridFunction(name, method, FunctionKind::GETTER));
  }

  /**
   * Registers the given C++ method as a property setter that can be called from JS, through the object's Prototype.
   * Example:
   * ```cpp
   * registerHybridSetter("foo", &MyObject::setFoo);
   * ```
   */
  template <typename Derived, typename ValueType>
  inline void registerHybridSetter(std::string name, InstanceMethod<Derived, void, ValueType> method) {
    if (_setters.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Property Setter \"" + name + "\" - a setter with that name already exists!");
    }
    if (_methods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Property Setter \"" + name + "\" - a method with that name already exists!");
    }

    _setters.emplace(name, HybridFunction::createHybridFunction(name, method, FunctionKind::SETTER));
  }

  /**
   * Registers the given C++ method as a Hybrid Method that can be called from JS, through the object's Prototype.
   * Example:
   * ```cpp
   * registerHybridMethod("sayHello", &MyObject::sayHello);
   * ```
   */
  template <typename Derived, typename ReturnType, typename... Args>
  inline void registerHybridMethod(std::string name, InstanceMethod<Derived, ReturnType, Args...> method) {
    if (_getters.contains(name) || _setters.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Method \"" + name + "\" - a property with that name already exists!");
    }
    if (_methods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Method \"" + name + "\" - a method with that name already exists!");
    }

    _methods.emplace(name, HybridFunction::createHybridFunction(name, method, FunctionKind::METHOD));
  }

  /**
   * Registers the given raw JSI C++ method as a Hybrid Method that can be called from JS, through the object's Prototype.
   * Example:
   * ```cpp
   * registerRawHybridMethod("sayHello", &MyObject::sayHello);
   * ```
   */
  template <typename Derived>
  inline void registerRawHybridMethod(std::string name, size_t expectedArgumentsCount, RawInstanceMethod<Derived> method) {
    if (_getters.contains(name) || _setters.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Method \"" + name + "\" - a property with that name already exists!");
    }
    if (_methods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Method \"" + name + "\" - a method with that name already exists!");
    }

    _methods.emplace(name, HybridFunction::createRawHybridFunction(name, expectedArgumentsCount, method));
  }
};

} // namespace margelo::nitro
