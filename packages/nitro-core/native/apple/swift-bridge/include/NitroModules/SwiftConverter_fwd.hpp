//
//  SwiftConverter_fwd.hpp
//  NitroModules
//

#pragma once

namespace margelo::nitro {

// Declare converter specializations without importing Swift's generated definitions.
template <typename T, typename SwiftTarget = void>
struct SwiftConverter;

} // namespace margelo::nitro
