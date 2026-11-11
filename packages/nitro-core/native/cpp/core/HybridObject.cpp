//
// Created by Marc Rousavy on 21.02.24.
//

#include "HybridObject.hpp"
#include "CommonGlobals.hpp"
#include "HybridNitroModulesProxy.hpp"
#include "JSIConverter.hpp"
#include "NitroDefines.hpp"

namespace margelo::nitro {

HybridObject::HybridObject(const char* NON_NULL name) : HybridObjectPrototype(), _name(name) {
#ifdef NITRO_DEBUG
  HybridNitroModulesProxy::debug_notifyHybridObjectAllocated();
#endif
}

HybridObject::~HybridObject() {
#ifdef NITRO_DEBUG
  HybridNitroModulesProxy::debug_notifyHybridObjectDeallocated();
#endif
}

std::string HybridObject::toString() {
  return "[HybridObject " + std::string(_name) + "]";
}

std::string HybridObject::getName() {
  return _name;
}

bool HybridObject::equals(const std::shared_ptr<HybridObject>& other) {
  return this == other.get();
}

std::shared_ptr<HybridObject> HybridObject::shared() {
  std::weak_ptr<HybridObject> weak = weak_from_this();
  if (auto shared = weak.lock()) [[likely]] {
    // We can lock to a shared_ptr!
    return shared;
  }
  // We are not managed inside a shared_ptr..
  throw std::runtime_error(std::string("HybridObject \"") + _name + "\" is not managed inside a std::shared_ptr - cannot access shared()!");
}

jsi::Value HybridObject::disposeRaw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value*, size_t) {
  // 1. Dispose any resources - this might be overridden by child classes to perform manual cleanup.
  dispose();
  // 2. Remove the NativeState from `this`
  jsi::Object thisObject = thisArg.asObject(runtime);
  thisObject.setNativeState(runtime, nullptr);
  // 3. Clear our object cache
  _objectCache.clear();

  return jsi::Value::undefined();
}

void HybridObject::loadHybridMethods() {
  registerHybrids(this, [](Prototype& prototype) {
    prototype.registerHybridGetter("name", &HybridObject::getName);
    prototype.registerHybridMethod("equals", &HybridObject::equals);
    prototype.registerHybridMethod("toString", &HybridObject::toString);
    prototype.registerRawHybridMethod("dispose", 0, &HybridObject::disposeRaw);
  });
}

jsi::Value HybridObject::toObject(jsi::Runtime& runtime) {
  // 1. Check if we have a jsi::WeakObject in cache that we can use to avoid re-creating the object each time
  auto cachedObject = _objectCache.find(&runtime);
  if (cachedObject != _objectCache.end() && cachedObject->second != nullptr) {
    // 1.1. We have a WeakObject, try to see if it is still alive
    jsi::Value value = cachedObject->second->lock(runtime);
    if (!value.isUndefined()) {
      // 1.2. It is still alive - we can use it instead of creating a new one! But first, let's update memory-size
      value.getObject(runtime).setExternalMemoryPressure(runtime, getExternalMemorySize());
      // 1.3. Return it now
      return value;
    }
  }

  // 2. Get the object's base prototype (global & shared)
  jsi::Value prototype = getPrototype(runtime);

  // 3. Create the object using Object.create(...)
  jsi::Object object = CommonGlobals::Object::create(runtime, prototype);

  // 4. Assign NativeState to the object so the prototype can resolve the native methods
  object.setNativeState(runtime, shared());

  // 5. Set memory size so Hermes GC knows about actual memory
  object.setExternalMemoryPressure(runtime, getExternalMemorySize());

#ifdef NITRO_DEBUG
  // 6. Assign a private __type property for debugging - this will be used so users know it's not just an empty object.
  std::string typeName = "HybridObject<" + std::string(_name) + ">";
  CommonGlobals::Object::defineProperty(runtime, object, "__type",
                                        PlainPropertyDescriptor{
                                            // .configurable has to be true because this property is non-frozen
                                            .configurable = true,
                                            .enumerable = true,
                                            .value = jsi::String::createFromAscii(runtime, typeName),
                                            .writable = false,
                                        });
#endif

  // 7. Throw a jsi::WeakObject pointing to our object into cache so subsequent calls can use it from cache
  {
    JSICacheReference cache = JSICache::getOrCreateCache(runtime);
    _objectCache[&runtime] = cache.makeShared(jsi::WeakObject(runtime, object));
  }

  // 8. Return it!
  return object;
}

} // namespace margelo::nitro
