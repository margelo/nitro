//
//  NativeNitroModules+NewArch.mm
//  react-native-nitro
//
//  Created by Marc Rousavy on 21.06.24.
//

#import "NativeNitroModules.h"

#ifdef RCT_NEW_ARCH_ENABLED

#import "CallInvokerDispatcher.hpp"
#import "InstallNitro.hpp"
#import "NitroLogger.hpp"

#import <ReactCommon/CallInvoker.h>
#import <ReactCommon/RCTTurboModuleWithJSIBindings.h>

using namespace facebook;
using namespace margelo;

// Make NativeNitroModules comply to RCTTurboModuleWithJSIBindings
@interface NativeNitroModules () <RCTTurboModuleWithJSIBindings>
@end

/**
 * NativeNitroModules implementation for the new architecture.
 * This uses `installJSIBindingsWithRuntime:` to install the `global.NitroModulesProxy` into the JS Runtime.
 */
@implementation NativeNitroModules {
  bool _didInstall;
  NSString* _Nullable _errorMessage;
  std::weak_ptr<react::CallInvoker> _callInvoker;
}
RCT_EXPORT_MODULE(NitroModules)

// React Native >= 0.87+
- (void)installJSIBindingsWithRuntime:(jsi::Runtime&)runtime callInvoker:(const std::shared_ptr<react::CallInvoker>&)callInvoker {
  _callInvoker = callInvoker;
  [self installNitroInRuntime:runtime];
}

// TODO: Delete this old overload when we drop support for RN 0.86
// React Native < 0.87
- (void)installJSIBindingsWithRuntime:(jsi::Runtime&)runtime {
  [self installNitroInRuntime:runtime];
}

- (void)installNitroInRuntime:(jsi::Runtime&)runtime {
  // 1. Get CallInvoker we cached statically
  std::shared_ptr<react::CallInvoker> callInvoker = _callInvoker.lock();
  if (callInvoker == nullptr) {
    throw std::runtime_error("Cannot install `global.NitroModulesProxy` - CallInvoker was null!");
  }

  // 2. Wrap CallInvoker as Dispatcher
  auto dispatcher = std::make_shared<nitro::CallInvokerDispatcher>(callInvoker);

  // 3. Install Nitro
  try {
    nitro::install(runtime, dispatcher);
    _didInstall = true;
  } catch (const std::exception& exc) {
    nitro::Logger::log(nitro::LogLevel::Error, "NitroModules", "Failed to install Nitro! %s", exc.what());
    _errorMessage = [NSString stringWithCString:exc.what() encoding:kCFStringEncodingUTF8];
    _didInstall = false;
  }
}

- (NSString*)install {
  if (_didInstall) {
    // installJSIBindingsWithRuntime ran successfully.
    return nil;
  } else {
    if (_errorMessage != nil) {
      return _errorMessage;
    }
    return @"installJSIBindingsWithRuntime: was not called - JSI Bindings could not be installed!";
  }
}

- (std::shared_ptr<react::TurboModule>)getTurboModule:(const react::ObjCTurboModule::InitParams&)params {
  // Cache the CallInvoker statically (weak) - we use it later in `installJSIBindingsWithRuntime:`.
  _callInvoker = params.jsInvoker;
  return std::make_shared<react::NativeNitroModulesSpecJSI>(params);
}

@end

#endif
