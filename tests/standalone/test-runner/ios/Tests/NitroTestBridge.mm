#import "NitroTestBridge.h"
#include "TestRuntime.hpp"
#include <exception>

NSString* _Nullable NitroRunTest(NSString* bundle, NSString* name, uint32_t timeoutMs, void (^onTestStarted)(void)) {
  try {
    auto failure = margelo::nitro::testing::runTest(bundle.UTF8String, name.UTF8String, timeoutMs, [onTestStarted] {
      if (onTestStarted)
        onTestStarted();
    });
    if (failure.empty()) {
      return nil;
    }
    return [[NSString alloc] initWithBytes:failure.data() length:failure.size() encoding:NSUTF8StringEncoding]
               ?: @"Native test failure could not be decoded as UTF-8.";
  } catch (const std::exception& error) {
    return [NSString stringWithUTF8String:error.what()] ?: @"Native exception could not be decoded as UTF-8.";
  } catch (...) {
    return @"Unknown native exception while running the JavaScript test.";
  }
}
