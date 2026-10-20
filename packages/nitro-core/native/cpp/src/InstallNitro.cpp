//
//  InstallNitro.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 05.10.24
//

#include <NitroModules/InstallNitro.hpp>
#include <NitroModules/CommonGlobals.hpp>
#include <NitroModules/detail/HybridNitroModulesProxy.hpp>

namespace margelo::nitro {

void install(jsi::Runtime& runtime, std::shared_ptr<Dispatcher> dispatcher) {
  // Registers a Dispatcher for Nitro to call back into the JS Runtime.
  // This allows creating Promises and calling back to JS.
  Dispatcher::installRuntimeGlobalDispatcher(runtime, dispatcher);

  // Installs NitroModulesProxy itself into the Runtime's global.
  install(runtime);
}

void install(jsi::Runtime& runtime) {
  // Installs global.NitroModulesProxy
  auto proxy = std::make_shared<detail::HybridNitroModulesProxy>();
  CommonGlobals::defineGlobal(runtime, KnownGlobalPropertyName::NITRO_MODULES_PROXY, proxy->toObject(runtime));
}

} // namespace margelo::nitro
