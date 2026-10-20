//
//  HybridClassRegistry.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 22.07.24.
//

#pragma once

#include <NitroModules/HybridClass.hpp>
#include <string>
#include <unordered_map>
#include <vector>

namespace margelo::nitro {

/** Registers shared type descriptors for lookup through NitroModules.getHybridClass(name). */
class HybridClassRegistry {
public:
  HybridClassRegistry() = delete;

  /** Register the descriptor under a namespaced lookup key, preserving its JavaScript class name. */
  static void registerHybridClass(const std::string& name, const std::shared_ptr<const HybridClass>& hybridClass);

  /** The built-in HybridObject and NitroModulesProxy types have no public constructors. */
  static jsi::Function getHybridClass(jsi::Runtime& runtime, const std::string& name);

  static bool hasHybridClass(const std::string& name);
  static std::vector<std::string> getAllHybridClassNames();

private:
  static std::unordered_map<std::string, std::shared_ptr<const HybridClass>>& getRegistry();
};

} // namespace margelo::nitro
