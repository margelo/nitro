#pragma once

#include <NitroModules/NitroDefines.hpp>
#include <functional>

namespace margelo::nitro {

using SwiftValueInitializer = std::function<void(void* NON_NULL)>;
using SwiftValueTryInitializer = std::function<bool(void* NON_NULL)>;
using SwiftValueConsumer = std::function<void(const void* NON_NULL)>;

} // namespace margelo::nitro
