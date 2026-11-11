//
//  HybridNitroModulesProxy.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 05.10.24
//

#pragma once

#include "BoxedHybridObject.hpp"
#include "HybridObject.hpp"
#include <memory>
#include <string>

namespace margelo::nitro {

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
  explicit HybridNitroModulesProxy() : HybridObject(TAG) {}

public:
  void loadHybridMethods() override;

public:
  // Hybrid Object Registry
  std::shared_ptr<HybridObject> createHybridObject(const std::string& name);
  bool hasHybridObject(const std::string& name);
  std::vector<std::string> getAllHybridObjectNames();

  // Helpers
  std::shared_ptr<BoxedHybridObject> box(const std::shared_ptr<HybridObject>& hybridObject);
  std::shared_ptr<HybridObject> updateMemorySize(const std::shared_ptr<HybridObject>& hybridObject);
  jsi::Value hasNativeState(jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* args, size_t size);
  jsi::Value isHybridObject(jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* args, size_t size);
  std::shared_ptr<ArrayBuffer> createNativeArrayBuffer(double size);

  // Build Info
  std::string getBuildType();
  std::string getVersion();

  // Allocation tests
  double debug_getTotalAllocatedHybridObjects();
  static void debug_notifyHybridObjectAllocated();
  static void debug_notifyHybridObjectDeallocated();

private:
  static constexpr auto TAG = "NitroModulesProxy";
};

} // namespace margelo::nitro
