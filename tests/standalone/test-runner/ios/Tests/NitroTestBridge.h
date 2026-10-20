#import <Foundation/Foundation.h>

/// Runs one named JS test. A nil result means success; otherwise the string
/// contains the assertion or native exception, including the JS stack.
FOUNDATION_EXPORT NSString* _Nullable NitroRunTest(NSString* _Nonnull bundle, NSString* _Nonnull name, uint32_t timeoutMs,
                                                   void (^_Nullable onTestStarted)(void));
