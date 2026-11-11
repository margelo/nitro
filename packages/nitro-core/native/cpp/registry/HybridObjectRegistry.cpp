//
//  HybridObjectRegistry.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 22.07.24.
//

#include "HybridObjectRegistry.hpp"
#include "NitroDefines.hpp"
#include "NitroLogger.hpp"
#include <numeric>

namespace margelo::nitro {

std::unordered_map<std::string, HybridObjectRegistry::HybridObjectConstructorFn>& HybridObjectRegistry::getRegistry() {
  static std::unordered_map<std::string, HybridObjectRegistry::HybridObjectConstructorFn> _constructorsMap;
  return _constructorsMap;
}

bool HybridObjectRegistry::hasHybridObject(const std::string& name) {
  return getRegistry().contains(name);
}

std::vector<std::string> HybridObjectRegistry::getAllHybridObjectNames() {
  std::vector<std::string> keys;
  keys.reserve(getRegistry().size());
  for (const auto& entry : getRegistry()) {
    keys.push_back(entry.first);
  }
  return keys;
}

std::string HybridObjectRegistry::getAllRegisteredHybridObjectNamesToString() {
  std::vector<std::string> names = getAllHybridObjectNames();
  if (names.empty()) {
    return "";
  }
  return std::accumulate(std::next(names.begin()), names.end(), names[0], [](std::string a, std::string b) { return a + ", " + b; });
}

void HybridObjectRegistry::registerHybridObjectConstructor(const std::string& hybridObjectName, HybridObjectConstructorFn&& constructorFn) {
  Logger::log(LogLevel::Info, TAG, "Registering HybridObject \"%s\"...", hybridObjectName.c_str());
  auto& map = HybridObjectRegistry::getRegistry();
#ifdef NITRO_DEBUG
  if (map.contains(hybridObjectName)) [[unlikely]] {
    auto allObjectNames = getAllRegisteredHybridObjectNamesToString();
    auto message =
        "HybridObject \"" + hybridObjectName +
        "\" has already been "
        "registered in the Nitro Modules HybridObjectRegistry! Suggestions:\n"
        "- If you just installed another library, maybe both libraries are using the same name?\n"
        "- If you just registered your own HybridObject, maybe you accidentally called `registerHybridObjectConstructor(...)` twice?\n"
        "- All registered HybridObjects: [" +
        allObjectNames + "]";
    throw std::runtime_error(message);
  }
#endif
  map.insert({hybridObjectName, std::move(constructorFn)});
  Logger::log(LogLevel::Info, TAG, "Successfully registered HybridObject \"%s\"!", hybridObjectName.c_str());
}

void HybridObjectRegistry::unregisterHybridObjectConstructor(const std::string& hybridObjectName) {
  Logger::log(LogLevel::Info, TAG, "Unregistering HybridObject \"%s\"...", hybridObjectName.c_str());
  auto& map = HybridObjectRegistry::getRegistry();
  map.erase(hybridObjectName);
}

std::shared_ptr<HybridObject> HybridObjectRegistry::createHybridObject(const std::string& hybridObjectName) {
  auto& map = HybridObjectRegistry::getRegistry();
  auto fn = map.find(hybridObjectName);
  if (fn == map.end()) [[unlikely]] {
    auto allObjectNames = getAllRegisteredHybridObjectNamesToString();
    auto message = "Cannot create an instance of HybridObject \"" + hybridObjectName +
                   "\" - It has not yet been registered in the Nitro Modules HybridObjectRegistry! Suggestions:\n"
                   "- If you use Nitrogen, make sure your `nitro.json` contains `" +
                   hybridObjectName +
                   "` on this platform.\n"
                   "- If you use Nitrogen, make sure your library (*Package.kt)/app (MainApplication.kt) calls "
                   "`$$androidCxxLibName$$OnLoad.initializeNative()` somewhere on app-startup.\n"
                   "- If you use Nitrogen, make sure your `cpp-adapter.cpp`/`OnLoad.cpp` calls "
                   "`margelo::nitro::$$cxxNamespace$$::registerNatives()` inside `facebook::jni::initialize(...)`.\n"
                   "- If you use Nitrogen, inspect the generated `$$androidCxxLibName$$OnLoad.cpp` file.\n"
                   "- If you don't use Nitrogen, make sure you called `HybridObjectRegistry.registerHybridObject(...)`."
                   "- All registered HybridObjects: [" +
                   allObjectNames + "]";
    throw std::runtime_error(message);
  }
  std::shared_ptr<HybridObject> instance = fn->second();

#ifdef NITRO_DEBUG
  if (instance == nullptr) [[unlikely]] {
    throw std::runtime_error("Failed to create HybridObject \"" + hybridObjectName + "\" - The constructor returned null!");
  }
  if (instance->getName() != hybridObjectName) [[unlikely]] {
    throw std::runtime_error("HybridObject's name (\"" + instance->getName() +
                             "\") "
                             "does not match the name it was registered with (\"" +
                             hybridObjectName + "\")!");
  }
#endif

  return instance;
}

} // namespace margelo::nitro
