//
//  Dispatcher.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 22.07.24.
//

#include "Dispatcher.hpp"
#include "CommonGlobals.hpp"
#include "JSIConverter.hpp"
#include "JSIHelpers.hpp"
#include "NitroDefines.hpp"
#include "NitroLogger.hpp"

namespace margelo::nitro {

using namespace facebook;

/**
 * This map is only statically linked once to this library.
 * If multiple versions of react-native-nitro-modules are linked, there would be multiple maps. We catch that issue later.
 */
std::unordered_map<jsi::Runtime * NON_NULL, std::weak_ptr<Dispatcher>> Dispatcher::_globalCache;

void Dispatcher::installRuntimeGlobalDispatcher(jsi::Runtime& runtime, std::shared_ptr<Dispatcher> dispatcher) {
  Logger::log(LogLevel::Info, TAG, "Installing global Dispatcher Holder into Runtime \"%s\"...", getRuntimeId(runtime).c_str());

  // Store a weak reference in global cache
  _globalCache[&runtime] = dispatcher;

  // Inject the dispatcher into Runtime global (runtime will hold a strong reference)
  jsi::Value dispatcherHolder = JSIConverter<std::shared_ptr<Dispatcher>>::toJSI(runtime, dispatcher);
  CommonGlobals::defineGlobal(runtime, KnownGlobalPropertyName::DISPATCHER, std::move(dispatcherHolder));
}

std::shared_ptr<Dispatcher> Dispatcher::getRuntimeGlobalDispatcher(jsi::Runtime& runtime) {
  auto found = _globalCache.find(&runtime);
  if (found != _globalCache.end()) [[likely]] {
    // the runtime is known - we have something in cache
    std::weak_ptr<Dispatcher> weakDispatcher = found->second;
    std::shared_ptr<Dispatcher> strongDispatcher = weakDispatcher.lock();
    if (strongDispatcher) {
      // the weak reference we cached is still valid - return it!
      return strongDispatcher;
    }
  }

  // If it's the main/UI Thread, we can inject the Dispatcher now
  if (ThreadUtils::isUIThread()) {
    auto uiDispatcher = ThreadUtils::createUIThreadDispatcher();
    Dispatcher::installRuntimeGlobalDispatcher(runtime, uiDispatcher);
  }

  Logger::log(LogLevel::Warning, TAG, "Unknown Runtime (%s), looking for Dispatcher through JSI global lookup...",
              getRuntimeId(runtime).c_str());
  // 1. Get global.__nitroDispatcher
  jsi::Value dispatcherHolderValue = getRuntimeGlobalDispatcherHolder(runtime);
  // 2. Cast it to the jsi::Object
  std::shared_ptr<Dispatcher> dispatcher = JSIConverter<std::shared_ptr<Dispatcher>>::fromJSI(runtime, dispatcherHolderValue);
  // 3. Throw it in our cache and return
  _globalCache[&runtime] = dispatcher;
  return dispatcher;
}

jsi::Value Dispatcher::getRuntimeGlobalDispatcherHolder(jsi::Runtime& runtime) {
  const jsi::PropNameID& dispatcherHolderPropName = CommonGlobals::getKnownGlobalPropertyName(runtime, KnownGlobalPropertyName::DISPATCHER);
  if (!runtime.global().hasProperty(runtime, dispatcherHolderPropName)) [[unlikely]] {
    throw std::runtime_error("The `jsi::Runtime` \"" + getRuntimeId(runtime) +
                             "\" does not support Callbacks or Promises because it does not have a `Dispatcher` installed!\n"
                             "To use Callbacks and Promises follow these steps;\n"
                             "1. Subclass `Dispatcher` with your implementation of `runAsync`/`runSync` for your Thread.\n"
                             "2. Call `Dispatcher::installRuntimeGlobalDispatcher(...)` with your `Runtime` and your `Dispatcher`.");
  }
  return runtime.global().getProperty(runtime, dispatcherHolderPropName);
}

} // namespace margelo::nitro
