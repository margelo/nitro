#include "NativeNitroModules.h"

#include "CallInvokerDispatcher.hpp"
#include "InstallNitro.hpp"
#include "NitroLogger.hpp"
#include "UIThreadDispatcher.hpp"

#include <exception>
#include <memory>

namespace winrt::NitroModules {

using namespace winrt::Microsoft::ReactNative;

void NativeNitroModules::Initialize(ReactContext const& reactContext, facebook::jsi::Runtime& runtime) noexcept {
  try {
    margelo::nitro::UIThreadDispatcher::setUIDispatcher(reactContext.UIDispatcher());

    std::shared_ptr<facebook::react::CallInvoker> callInvoker = reactContext.CallInvoker();
    if (callInvoker == nullptr) {
      throw std::runtime_error("React Native's CallInvoker is null!");
    }
    auto dispatcher = std::make_shared<margelo::nitro::CallInvokerDispatcher>(callInvoker);

    margelo::nitro::install(runtime, dispatcher);
  } catch (const std::exception& exception) {
    _errorMessage = exception.what();
    margelo::nitro::Logger::log(margelo::nitro::LogLevel::Error, "NitroModules", "Failed to install Nitro: %s", exception.what());
  } catch (...) {
    _errorMessage = "An unknown error occurred.";
    margelo::nitro::Logger::log(margelo::nitro::LogLevel::Error, "NitroModules", "Failed to install Nitro - unknown error!");
  }
}

std::optional<std::string> NativeNitroModules::install() noexcept {
  return _errorMessage;
}

} // namespace winrt::NitroModules
