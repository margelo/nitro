#pragma once

#include <optional>
#include <string>

#include <jsi/jsi.h>

#include <NativeModules.h>
#include <ReactContext.h>

namespace winrt::NitroModules {

REACT_MODULE_NOREG(NativeNitroModules, L"NitroModules")
struct NativeNitroModules {
  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const& reactContext, facebook::jsi::Runtime& runtime) noexcept;

  REACT_SYNC_METHOD(install)
  std::optional<std::string> install() noexcept;

private:
  std::optional<std::string> _errorMessage;
};

} // namespace winrt::NitroModules
