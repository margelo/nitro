#include "ReactPackageProvider.h"

#include "NativeNitroModules.h"

#include <NativeModules.h>

namespace winrt::NitroModules {

using namespace winrt::Microsoft::ReactNative;

namespace {

struct NitroReactPackageProvider : winrt::implements<NitroReactPackageProvider, IReactPackageProvider> {
  void CreatePackage(IReactPackageBuilder const& packageBuilder) noexcept {
#ifdef RNW_NEW_ARCH
    packageBuilder.AddTurboModule(L"NitroModules", MakeModuleProvider<NativeNitroModules>());
#else
    packageBuilder.AddModule(L"NitroModules", MakeModuleProvider<NativeNitroModules>());
#endif
  }
};

} // namespace

IReactPackageProvider ReactPackageProvider() {
  return winrt::make<NitroReactPackageProvider>();
}

} // namespace winrt::NitroModules
