//
//  HybridNitroModulesProxy.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 05.10.24
//

#include <NitroModules/detail/HybridNitroModulesProxy.hpp>
#include <NitroModules/HybridClassRegistry.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/NitroDefines.hpp>

namespace margelo::nitro::detail {

const std::shared_ptr<const HybridClass>& HybridNitroModulesProxy::Class::get() {
  static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
    clazz.registerRawHybridMethod("getHybridClass", 1, &HybridNitroModulesProxy::getHybridClassRaw);
    clazz.registerHybridMethod("hasHybridClass", &HybridNitroModulesProxy::hasHybridClass);
    clazz.registerRawHybridMethod("isHybridObject", 1, &HybridNitroModulesProxy::isHybridObject);
    clazz.registerHybridMethod("getAllHybridClassNames", &HybridNitroModulesProxy::getAllHybridClassNames);

    clazz.registerHybridMethod("box", &HybridNitroModulesProxy::box);
    clazz.registerHybridMethod("updateMemorySize", &HybridNitroModulesProxy::updateMemorySize);

    clazz.registerHybridMethod("createNativeArrayBuffer", &HybridNitroModulesProxy::createNativeArrayBuffer);
    clazz.registerRawHybridMethod("hasNativeState", 1, &HybridNitroModulesProxy::hasNativeState);

    clazz.registerHybridProperty("buildType", &HybridNitroModulesProxy::getBuildType);
    clazz.registerHybridProperty("version", &HybridNitroModulesProxy::getVersion);

    clazz.registerHybridMethod("debug_getTotalAllocatedHybridObjects", &HybridNitroModulesProxy::debug_getTotalAllocatedHybridObjects);
  });
  return hybridClass;
}

// Hybrid Class Registry
jsi::Value HybridNitroModulesProxy::getHybridClassRaw(jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args, size_t count) {
  if (count != 1 || !args[0].isString()) {
    throw jsi::JSError(runtime, "NitroModules.getHybridClass(name) expects one string argument.");
  }
  return HybridClassRegistry::getHybridClass(runtime, args[0].getString(runtime).utf8(runtime));
}

bool HybridNitroModulesProxy::hasHybridClass(const std::string& name) {
  return HybridClassRegistry::hasHybridClass(name);
}

std::vector<std::string> HybridNitroModulesProxy::getAllHybridClassNames() {
  return HybridClassRegistry::getAllHybridClassNames();
}

// Helpers
std::shared_ptr<BoxedHybridObject> HybridNitroModulesProxy::box(const std::shared_ptr<HybridObject>& hybridObject) {
  return std::make_shared<BoxedHybridObject>(hybridObject);
}

jsi::Value HybridNitroModulesProxy::hasNativeState(jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args, size_t size) {
  if (size != 1 || !args[0].isObject()) {
    return false;
  }
  return args[0].getObject(runtime).hasNativeState(runtime);
}

jsi::Value HybridNitroModulesProxy::isHybridObject(jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args, size_t size) {
  if (size != 1 || !args[0].isObject()) {
    return false;
  }
  jsi::Object object = args[0].getObject(runtime);
  if (!object.hasNativeState(runtime)) {
    return false;
  }
  std::shared_ptr<jsi::NativeState> nativeState = object.getNativeState(runtime);
  std::shared_ptr<HybridObject> maybeHybridObject = std::dynamic_pointer_cast<HybridObject>(nativeState);
  bool isHybrid = maybeHybridObject != nullptr;
  return jsi::Value(isHybrid);
}

std::shared_ptr<HybridObject> HybridNitroModulesProxy::updateMemorySize(const std::shared_ptr<HybridObject>& hybridObject) {
  // If a hybridObject goes from Native -> JS, it will update its memory size internally (in `HybridObject::toObject(..)`).
  // This is all that function does.
  return hybridObject;
}

ArrayBuffer HybridNitroModulesProxy::createNativeArrayBuffer(double size) {
  return ArrayBuffer::allocate(static_cast<size_t>(size));
}

// Build Info
std::string HybridNitroModulesProxy::getBuildType() {
#ifdef NITRO_DEBUG
  return "debug";
#else
  return "release";
#endif
}

std::string HybridNitroModulesProxy::getVersion() {
  return NITRO_VERSION;
}

// Allocation tests
static std::atomic_size_t _hybridObjectInstancesCount{0};
double HybridNitroModulesProxy::debug_getTotalAllocatedHybridObjects() {
  size_t count = _hybridObjectInstancesCount.load(std::memory_order_relaxed);
  return static_cast<double>(count);
}

void HybridNitroModulesProxy::debug_notifyHybridObjectAllocated() {
  _hybridObjectInstancesCount.fetch_add(1, std::memory_order_relaxed);
}

void HybridNitroModulesProxy::debug_notifyHybridObjectDeallocated() {
  _hybridObjectInstancesCount.fetch_sub(1, std::memory_order_relaxed);
}

} // namespace margelo::nitro::detail
