//
//  HybridClass.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 07.08.24.
//

#include <NitroModules/CommonGlobals.hpp>
#include <NitroModules/HybridClass.hpp>
#include <NitroModules/JSICache.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/NitroLogger.hpp>

namespace margelo::nitro {

namespace {

  void defineMethod(jsi::Runtime& runtime, const jsi::Object& object, const std::string& name, const HybridFunction& method,
                    bool enumerable) {
    CommonGlobals::Object::defineProperty(runtime, object, name.c_str(),
                                          PlainPropertyDescriptor{
                                              .configurable = false,
                                              .enumerable = enumerable,
                                              .value = method.toJSFunction(runtime),
                                              .writable = false,
                                          });
  }

  void defineProperty(jsi::Runtime& runtime, const jsi::Object& object, const std::string& name, const HybridProperty& property,
                      bool enumerable) {
    if (property.setter.has_value()) {
      CommonGlobals::Object::defineProperty(runtime, object, name.c_str(),
                                            ComputedPropertyDescriptor{
                                                .configurable = false,
                                                .enumerable = enumerable,
                                                .get = property.getter.toJSFunction(runtime),
                                                .set = property.setter->toJSFunction(runtime),
                                            });
    } else {
      CommonGlobals::Object::defineProperty(runtime, object, name.c_str(),
                                            ComputedReadonlyPropertyDescriptor{
                                                .configurable = false,
                                                .enumerable = enumerable,
                                                .get = property.getter.toJSFunction(runtime),
                                            });
    }
  }

} // namespace

const JSClass& HybridClass::getOrCreateJSClass(jsi::Runtime& runtime) const {
  // 1. Reuse both objects from this Runtime's cache.
  JSICache& cache = JSICache::getOrCreateCache(runtime);
  const JSClass* cached = cache.getClass(getId());
  if (cached != nullptr) {
    return *cached;
  }

  // 2. Materialize the base first, then create this type's instance prototype.
  Logger::log(LogLevel::Info, "HybridClass", "Creating new JS prototype for \"%s\"...", _name.c_str());
  const JSClass* base = _base != nullptr ? &_base->getOrCreateJSClass(runtime) : nullptr;
  jsi::Object prototypeObject = base != nullptr ? jsi::Object::create(runtime, jsi::Value(runtime, base->prototype)) : jsi::Object(runtime);

  // 3. Add all Hybrid Methods and Properties to the Prototype (shared across instances)
  for (const auto& [name, method] : getMethods()) {
    defineMethod(runtime, prototypeObject, name, method, true);
  }
  for (const auto& [name, property] : getProperties()) {
    defineProperty(runtime, prototypeObject, name, property, true);
  }

  // 4. In DEBUG, add a __type info to the prototype object.
#ifdef NITRO_DEBUG
  std::string prototypeName = "Prototype<" + _name + ">";
  CommonGlobals::Object::defineProperty(runtime, prototypeObject, "__type",
                                        PlainPropertyDescriptor{
                                            .configurable = false,
                                            .enumerable = true,
                                            .value = jsi::String::createFromAscii(runtime, prototypeName),
                                            .writable = false,
                                        });
#endif

  // 5. Create the constructor function.
  jsi::HostFunctionType constructor;
  size_t argumentCount = 0;
  if (_constructor.has_value()) {
    constructor = _constructor->getHostFunction();
    argumentCount = _constructor->getParamCount();
  } else {
    constructor = [name = _name](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value*, size_t) -> jsi::Value {
      throw jsi::JSError(runtime, "HybridClass \"" + name + "\" has no public constructor.");
    };
  }
  auto constructorFunction = jsi::Function::createFromHostFunction(runtime, jsi::PropNameID::forAscii(runtime, _name),
                                                                   static_cast<unsigned int>(argumentCount), std::move(constructor));

  // 6. Set the constructor's prototype to the base constructor to inherit static methods and properties.
  if (base != nullptr) {
    constructorFunction.setPrototype(runtime, jsi::Value(runtime, base->constructor));
  }

  // 7. Add all static Hybrid Methods and Properties to the Constructor (static)
  for (const auto& [name, method] : _staticMethods) {
    defineMethod(runtime, constructorFunction, name, method, false);
  }
  for (const auto& [name, property] : _staticProperties) {
    defineProperty(runtime, constructorFunction, name, property, false);
  }

  // 8. Link .prototype and .constructor for JavaScript.
  CommonGlobals::Object::defineProperty(runtime, constructorFunction, "prototype",
                                        PlainPropertyDescriptor{
                                            .configurable = false,
                                            .enumerable = false,
                                            .value = jsi::Value(runtime, prototypeObject),
                                            .writable = false,
                                        });
  CommonGlobals::Object::defineProperty(runtime, prototypeObject, "constructor",
                                        PlainPropertyDescriptor{
                                            .configurable = false,
                                            .enumerable = false,
                                            .value = jsi::Value(runtime, constructorFunction),
                                            .writable = false,
                                        });

  // 9. Freeze the completed instance prototype in debug builds.
#ifdef NITRO_DEBUG
  CommonGlobals::Object::freeze(runtime, prototypeObject);
#endif

  // 10. Publish one complete cache entry. Its references stay valid until Runtime teardown.
  return cache.setClass(getId(), JSClass{std::move(prototypeObject), std::move(constructorFunction)});
}

} // namespace margelo::nitro
