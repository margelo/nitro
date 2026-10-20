//
//  HybridClassRegistry.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 22.07.24.
//

#include <NitroModules/HybridClassRegistry.hpp>
#include <NitroModules/HybridObject.hpp>
#include <NitroModules/detail/HybridNitroModulesProxy.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <cassert>
#include <mutex>

namespace margelo::nitro {

static std::mutex registryMutex;

std::unordered_map<std::string, std::shared_ptr<const HybridClass>>& HybridClassRegistry::getRegistry() {
  static std::unordered_map<std::string, std::shared_ptr<const HybridClass>> classes = {
    {HybridObject::Class::name, HybridObject::Class::get()},
    {detail::HybridNitroModulesProxy::Class::name, detail::HybridNitroModulesProxy::Class::get()},
  };
  return classes;
}

void HybridClassRegistry::registerHybridClass(const std::string& name, const std::shared_ptr<const HybridClass>& hybridClass) {
#ifdef NITRO_DEBUG
  assert(hybridClass != nullptr && "Cannot register a null HybridClass.");
#endif
  std::lock_guard<std::mutex> lock(registryMutex);
  auto& registry = getRegistry();
  registry.try_emplace(name, hybridClass);
}

jsi::Function HybridClassRegistry::getHybridClass(jsi::Runtime& runtime, const std::string& name) {
  std::shared_ptr<const HybridClass> hybridClass;
  {
    std::lock_guard<std::mutex> lock(registryMutex);
    const auto& registry = getRegistry();
    auto entry = registry.find(name);
    if (entry != registry.end()) {
      hybridClass = entry->second;
    }
  }
  if (hybridClass == nullptr) {
    throw jsi::JSError(runtime, "HybridClass \"" + name + "\" is not registered. Regenerate Nitrogen bindings and rebuild the native app.");
  }
  // Materialize the JavaScript class without holding the registry lock.
  return hybridClass->getOrCreateJSClass(runtime).constructor.getFunction(runtime);
}

bool HybridClassRegistry::hasHybridClass(const std::string& name) {
  std::lock_guard<std::mutex> lock(registryMutex);
  return getRegistry().contains(name);
}

std::vector<std::string> HybridClassRegistry::getAllHybridClassNames() {
  std::lock_guard<std::mutex> lock(registryMutex);
  const auto& registry = getRegistry();
  std::vector<std::string> names;
  names.reserve(registry.size());
  for (const auto& entry : registry) {
    names.push_back(entry.first);
  }
  return names;
}

} // namespace margelo::nitro
