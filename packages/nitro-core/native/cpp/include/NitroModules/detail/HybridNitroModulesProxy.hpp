//
//  HybridNitroModulesProxy.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 05.10.24
//

#pragma once

#include <NitroModules/BoxedHybridObject.hpp>
#include <NitroModules/HybridObject.hpp>
#include <NitroModules/HybridClass.hpp>
#include <memory>
#include <string>

namespace margelo::nitro::detail {

/**
 * Represents the entry point for all other HybridObjects.
 * The flow is as following:
 * 1. (optional) Install a Dispatcher in `jsi::Runtime` to use async/callbacks.
 * 2. Create an instance of `HybridNitroModulesProxy`
 * 3. Pass the object from `.toObject()` it to JS (either install in global, or return somehow)
 * 4. From JS, you can access methods on this HybridObject to create all other HybridObjects.
 */
class HybridNitroModulesProxy final : public HybridObject {
public:
  HybridNitroModulesProxy() = default;

public:
  struct Class {
    using Base = HybridObject::Class;
    static constexpr const char* name = "NitroModulesProxy";
    static const std::shared_ptr<const HybridClass>& get();
  };

public:
  // Hybrid Class Registry
  jsi::Value getHybridClassRaw(jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args, size_t count);
  bool hasHybridClass(const std::string& name);
  std::vector<std::string> getAllHybridClassNames();

  // Helpers
  std::shared_ptr<BoxedHybridObject> box(const std::shared_ptr<HybridObject>& hybridObject);
  std::shared_ptr<HybridObject> updateMemorySize(const std::shared_ptr<HybridObject>& hybridObject);
  jsi::Value hasNativeState(jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* args, size_t size);
  jsi::Value isHybridObject(jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* args, size_t size);
  ArrayBuffer createNativeArrayBuffer(double size);

  // Build Info
  std::string getBuildType();
  std::string getVersion();

  // Allocation tests
  double debug_getTotalAllocatedHybridObjects();
  static void debug_notifyHybridObjectAllocated();
  static void debug_notifyHybridObjectDeallocated();

protected:
  const std::shared_ptr<const HybridClass>& getHybridClass() override {
    return Class::get();
  }
};

} // namespace margelo::nitro::detail
