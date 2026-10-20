//
//  Dispatcher.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 22.07.24.
//

#include <NitroModules/Dispatcher.hpp>
#include <NitroModules/JSIHelpers.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/NitroLogger.hpp>
#include <NitroModules/detail/RuntimeData.hpp>

namespace margelo::nitro {

using namespace facebook;

// Identifies the Dispatcher in a jsi::Runtime's runtime data.
static constexpr jsi::UUID RUNTIME_DATA_UUID{0x98d1d247, 0x9aa3, 0x4f4f, 0xbf4a, 0xdecce3bd8dc1};

void Dispatcher::installRuntimeGlobalDispatcher(jsi::Runtime& runtime, std::shared_ptr<Dispatcher> dispatcher) {
  Logger::log(LogLevel::Info, TAG, "Installing Dispatcher into Runtime \"%s\"...", getRuntimeId(runtime).c_str());

  // Store it in the Runtime's data, which holds a strong reference until the Runtime is destroyed
  detail::RuntimeData::create(runtime, RUNTIME_DATA_UUID, std::move(dispatcher));
}

std::shared_ptr<Dispatcher> Dispatcher::getRuntimeGlobalDispatcher(jsi::Runtime& runtime) {
  std::shared_ptr<Dispatcher>* dispatcher = detail::RuntimeData::get<std::shared_ptr<Dispatcher>>(runtime, RUNTIME_DATA_UUID);
  if (dispatcher != nullptr) [[likely]] {
    return *dispatcher;
  }

  // If it's the main/UI Thread, we can inject the Dispatcher now
  if (ThreadUtils::isUIThread()) {
    auto uiDispatcher = ThreadUtils::createUIThreadDispatcher();
    Dispatcher::installRuntimeGlobalDispatcher(runtime, uiDispatcher);
    return uiDispatcher;
  }

  throw std::runtime_error("The `jsi::Runtime` \"" + getRuntimeId(runtime) +
                           "\" does not support Callbacks or Promises because it does not have a `Dispatcher` installed!\n"
                           "To use Callbacks and Promises follow these steps;\n"
                           "1. Subclass `Dispatcher` with your implementation of `runAsync`/`runSync` for your Thread.\n"
                           "2. Call `Dispatcher::installRuntimeGlobalDispatcher(...)` with your `Runtime` and your `Dispatcher`.");
}

} // namespace margelo::nitro
