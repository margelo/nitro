//
//  NativeNitroModules.mm
//  react-native-nitro
//
//  Created by Marc Rousavy on 21.06.24.
//

#import <NitroModulesReactNative/NativeNitroModules.h>

#import <NitroModulesReactNative/detail/CallInvokerDispatcher.hpp>
#import <NitroModules/InstallNitro.hpp>

#import <ReactCommon/CallInvoker.h>
#import <ReactCommon/RCTTurboModuleWithJSIBindings.h>

using namespace facebook;
using namespace margelo;

@interface NativeNitroModules () <RCTTurboModuleWithJSIBindings>
@end

@implementation NativeNitroModules
RCT_EXPORT_MODULE(NitroModules)

- (void)installJSIBindingsWithRuntime:(jsi::Runtime&)runtime callInvoker:(const std::shared_ptr<react::CallInvoker>&)callInvoker {
  auto dispatcher = std::make_shared<nitro::detail::CallInvokerDispatcher>(callInvoker);
  nitro::install(runtime, dispatcher);
}

- (std::shared_ptr<react::TurboModule>)getTurboModule:(const react::ObjCTurboModule::InitParams&)params {
  return std::make_shared<react::NativeNitroModulesSpecJSI>(params);
}

@end
