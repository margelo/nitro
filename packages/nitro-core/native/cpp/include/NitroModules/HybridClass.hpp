//
//  HybridClass.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 07.08.24.
//

#pragma once

#include <NitroModules/HybridFunction.hpp>
#include <NitroModules/JSClass.hpp>
#include <memory>
#include <optional>
#include <string>
#include <type_traits>
#include <typeindex>
#include <unordered_map>

namespace margelo::nitro {

using namespace facebook;

/**
 * The type of a HybridObject's nested `Class`. Identifies its HybridClass and keys the per-Runtime cache.
 */
using HybridClassId = std::type_index;

struct HybridProperty {
  HybridFunction getter;
  std::optional<HybridFunction> setter;
};

/**
 * Shared metadata for a HybridObject class: its name, base class,
 * constructor, and static and instance methods and properties.
 *
 * Each HybridClass materializes one JavaScript constructor and instance prototype
 * per Runtime. HybridObject instances keep their own native state and share these
 * JavaScript methods through that prototype.
 */
struct HybridClass final {
private:
  std::string _name;
  HybridClassId _id;
  // The base class's descriptor, or null for the root.
  std::shared_ptr<const HybridClass> _base;
  std::unordered_map<std::string, HybridFunction> _methods;
  std::unordered_map<std::string, HybridProperty> _properties;
  std::optional<HybridFunction> _constructor;
  std::unordered_map<std::string, HybridFunction> _staticMethods;
  std::unordered_map<std::string, HybridProperty> _staticProperties;

private:
  HybridClass(std::string name, const HybridClassId& id, std::shared_ptr<const HybridClass> base)
      : _name(std::move(name)), _id(id), _base(std::move(base)) {
#ifdef NITRO_DEBUG
    if (!isAscii(_name)) [[unlikely]] {
      throw std::runtime_error("HybridClass \"" + _name + "\" has a non-ASCII name. HybridObject class and member names must be ASCII.");
    }
#endif
  }

public:
  /**
   * Descriptors own potentially large member maps. Share their immutable pointer instead.
   */
  HybridClass(const HybridClass&) = delete;
  HybridClass(HybridClass&&) = delete;
  HybridClass& operator=(const HybridClass&) = delete;
  HybridClass& operator=(HybridClass&&) = delete;

  /**
   * Build the descriptor for a HybridObject's nested `Class`, then publish it as immutable metadata shared by all instances.
   * `Class::name` is the JavaScript class name, and `Class::Base` is the base class's `Class`, or `void` for the root.
   */
  template <typename Class, typename Initializer>
  static std::shared_ptr<const HybridClass> create(Initializer&& initialize) {
    std::shared_ptr<const HybridClass> base;
    if constexpr (!std::is_void_v<typename Class::Base>) {
      base = Class::Base::get();
    }
    auto hybridClass = std::shared_ptr<HybridClass>(new HybridClass(Class::name, typeid(Class), std::move(base)));
    initialize(*hybridClass);
    return hybridClass;
  }

  /**
   * Materialize this type's JavaScript class, cached per Runtime.
   * The returned reference belongs to the Runtime's cache and stays valid until Runtime teardown.
   * Use it only on the Runtime's thread within the current call; do not store it.
   */
  const JSClass& getOrCreateJSClass(jsi::Runtime& runtime) const;

  inline const std::string& getName() const noexcept {
    return _name;
  }

  inline bool hasBase() const noexcept {
    return _base != nullptr;
  }
  inline const std::shared_ptr<const HybridClass>& getBase() const noexcept {
    return _base;
  }
  inline const HybridClassId& getId() const noexcept {
    return _id;
  }
  inline const std::unordered_map<std::string, HybridFunction>& getMethods() const noexcept {
    return _methods;
  }
  inline const std::unordered_map<std::string, HybridProperty>& getProperties() const noexcept {
    return _properties;
  }

public:
  /**
   * Registers the given C++ factory for calls to JavaScript's `new` operator.
   * Example:
   * ```cpp
   * registerHybridConstructor(&MyObject::create);
   * ```
   */
  template <typename ReturnType, typename... Args>
  void registerHybridConstructor(ReturnType (*NON_NULL constructor)(Args...)) {
    _constructor = HybridFunction::createStaticHybridFunction(_name, constructor);
  }

  /**
   * Registers the given C++ function as a static Hybrid Method on this type's JavaScript constructor.
   * Example:
   * ```cpp
   * registerStaticHybridMethod("add", &MyObject::add);
   * ```
   * Nitrogen passes a `directFactory` for signatures it can call without `JSIConverter`s, see `DirectCall.hpp`.
   */
  template <typename ReturnType, typename... Args>
  void registerStaticHybridMethod(std::string name, ReturnType (*NON_NULL method)(Args...), direct::Factory directFactory = nullptr) {
    if (_staticProperties.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Static Hybrid Method \"" + name + "\" - a property with that name already exists!");
    }
    if (_staticMethods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Static Hybrid Method \"" + name + "\" - a method with that name already exists!");
    }
    _staticMethods.emplace(name, HybridFunction::createStaticHybridFunction(name, method, directFactory));
  }

  /**
   * Registers the given C++ getter as a read-only static property on this type's JavaScript constructor.
   * Example:
   * ```cpp
   * registerStaticHybridProperty("foo", &MyObject::getFoo);
   * ```
   */
  template <typename ReturnType>
    requires JSIEncodable<ReturnType>
  inline void registerStaticHybridProperty(std::string name, ReturnType (*NON_NULL getter)()) {
    registerStaticHybridProperty(name, HybridProperty{
                                           .getter = HybridFunction::createStaticHybridFunction(name, getter),
                                           .setter = std::nullopt,
                                       });
  }

  /**
   * Registers the given C++ getter and setter as a static property on this type's JavaScript constructor.
   * Example:
   * ```cpp
   * registerStaticHybridProperty("foo", &MyObject::getFoo, &MyObject::setFoo);
   * ```
   */
  template <typename ReturnType, typename ValueType>
    requires(JSIEncodable<ReturnType> && JSIDecodable<std::decay_t<ValueType>>)
  inline void registerStaticHybridProperty(std::string name, ReturnType (*NON_NULL getter)(), void (*NON_NULL setter)(ValueType)) {
    registerStaticHybridProperty(name, HybridProperty{
                                           .getter = HybridFunction::createStaticHybridFunction(name, getter),
                                           .setter = HybridFunction::createStaticHybridFunction(name, setter),
                                       });
  }

  /**
   * Registers the given C++ getter as a read-only property on this type's JavaScript prototype.
   * Example:
   * ```cpp
   * registerHybridProperty("foo", &MyObject::getFoo);
   * ```
   */
  template <typename Derived, typename ReturnType>
    requires JSIEncodable<ReturnType>
  inline void registerHybridProperty(std::string name, InstanceMethod<Derived, ReturnType> getter) {
    registerHybridProperty(name, HybridProperty{
                                     .getter = HybridFunction::createHybridFunction(name, getter, FunctionKind::GETTER),
                                     .setter = std::nullopt,
                                 });
  }

  /**
   * Registers the given C++ getter and setter as a property on this type's JavaScript prototype.
   * Example:
   * ```cpp
   * registerHybridProperty("foo", &MyObject::getFoo, &MyObject::setFoo);
   * ```
   */
  template <typename GetterClass, typename ReturnType, typename SetterClass, typename ValueType>
    requires(JSIEncodable<ReturnType> && JSIDecodable<std::decay_t<ValueType>>)
  inline void registerHybridProperty(std::string name, InstanceMethod<GetterClass, ReturnType> getter,
                                     InstanceMethod<SetterClass, void, ValueType> setter) {
    registerHybridProperty(name, HybridProperty{
                                     .getter = HybridFunction::createHybridFunction(name, getter, FunctionKind::GETTER),
                                     .setter = HybridFunction::createHybridFunction(name, setter, FunctionKind::SETTER),
                                 });
  }

  /**
   * Registers the given C++ method as a Hybrid Method that can be called from JS, through the object's prototype.
   * Example:
   * ```cpp
   * registerHybridMethod("sayHello", &MyObject::sayHello);
   * ```
   */
  template <typename Derived, typename ReturnType, typename... Args>
    requires((JSIDecodable<std::decay_t<Args>> && ...) && (std::is_void_v<ReturnType> || JSIEncodable<ReturnType>))
  inline void registerHybridMethod(std::string name, InstanceMethod<Derived, ReturnType, Args...> method) {
    if (_properties.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Method \"" + name + "\" - a property with that name already exists!");
    }
    if (_methods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Method \"" + name + "\" - a method with that name already exists!");
    }

    _methods.emplace(name, HybridFunction::createHybridFunction(name, method, FunctionKind::METHOD));
  }

  /**
   * Registers the given raw JSI C++ method as a Hybrid Method that can be called from JS, through the object's prototype.
   * Example:
   * ```cpp
   * registerRawHybridMethod("sayHello", 0, &MyObject::sayHello);
   * ```
   */
  template <typename Derived>
  inline void registerRawHybridMethod(std::string name, size_t expectedArgumentsCount, RawInstanceMethod<Derived> method) {
    if (_properties.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Method \"" + name + "\" - a property with that name already exists!");
    }
    if (_methods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Method \"" + name + "\" - a method with that name already exists!");
    }

    _methods.emplace(name, HybridFunction::createRawHybridFunction(name, expectedArgumentsCount, method));
  }

private:
  void registerHybridProperty(std::string name, HybridProperty property) {
    if (_properties.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Property \"" + name + "\" - a property with that name already exists!");
    }
    if (_methods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Hybrid Property \"" + name + "\" - a method with that name already exists!");
    }
    _properties.emplace(std::move(name), std::move(property));
  }

  void registerStaticHybridProperty(std::string name, HybridProperty property) {
    if (_staticProperties.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Static Hybrid Property \"" + name + "\" - a property with that name already exists!");
    }
    if (_staticMethods.contains(name)) [[unlikely]] {
      throw std::runtime_error("Cannot add Static Hybrid Property \"" + name + "\" - a method with that name already exists!");
    }
    _staticProperties.emplace(std::move(name), std::move(property));
  }
};

} // namespace margelo::nitro
