#pragma once

#include <cstdint>
#include <string>

namespace margelo::nitro::testing {

// Each call owns a fresh Hermes runtime on the calling thread. Native fixtures
// must be registered first. An empty result means success; failures include the
// test name and JS stack. No C++ exception crosses the Swift/JNI boundary.
std::string runTest(const std::string& bundle, const std::string& name, uint32_t timeoutMs = 10000);

} // namespace margelo::nitro::testing
