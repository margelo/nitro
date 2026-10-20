#pragma once

#include <cstdint>
#include <functional>
#include <string>

namespace margelo::nitro::testing {

// Each call owns a fresh Hermes runtime on the calling thread. Native fixtures
// must be registered first. An empty result means success; failures include the
// test name and JS stack. No C++ exception crosses the Swift/JNI boundary.
// Bundle compilation is cached outside the JS deadlines. Setup and execution
// each receive timeoutMs; getNitroTestTimeoutMs(name) can override execution only.
// onTestStarted lets runner contract tests synchronize two initialized runtimes.
std::string runTest(const std::string& bundle, const std::string& name, uint32_t timeoutMs = 10000,
                    const std::function<void()>& onTestStarted = {});

} // namespace margelo::nitro::testing
