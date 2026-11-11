//
//  NativeNitroModules.h
//  NitroModules
//
//  Created by Marc Rousavy on 07.10.24.
//

#ifdef RCT_NEW_ARCH_ENABLED

// New Architecture uses the Codegen'd Spec (TurboModule)
#import <NitroModulesSpec/NitroModulesSpec.h>
@interface NativeNitroModules : NSObject <NativeNitroModulesSpec>
@end

#else

// Old Architecture is an untyped RCTBridgeModule
#import <React/RCTBridgeModule.h>
@interface NativeNitroModules : NSObject <RCTBridgeModule>
@end

#endif
