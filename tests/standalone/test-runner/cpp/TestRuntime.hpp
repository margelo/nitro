#pragma once

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace margelo::nitro::testing {

// Runs a file's cases in order in one fresh Hermes runtime on the calling thread.
// After a case fails, continues the remaining cases in a new runtime. Returns all
// failures with their case names and JS stacks. A setup failure stops the suite.
// No C++ exception crosses the Swift/JNI boundary. Bundle compilation is cached
// outside the JS deadlines. Setup and each case receive timeoutMs;
// getNitroTestTimeoutMs(name) can override execution only. onTestStarted runs
// after setup, before each case. The runtime is destroyed before returning.
std::string runSuite(const std::string& bundle, const std::vector<std::string>& names, uint32_t timeoutMs = 10000,
                     const std::function<void()>& onTestStarted = {});

} // namespace margelo::nitro::testing
