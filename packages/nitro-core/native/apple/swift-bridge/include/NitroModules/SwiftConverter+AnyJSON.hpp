//
//  SwiftConverter+AnyJSON.hpp
//  NitroModulesSwiftBridge
//

#pragma once

#include <NitroModules/AnyJSON.hpp>
#include <NitroModules/SwiftConverter.hpp>

namespace NitroModules {
class AnyJSON;
}

namespace margelo::nitro {

template <>
struct SwiftConverter<AnyJSON> final {
  using SwiftType = NitroModules::AnyJSON;

  static AnyJSON fromSwift(const SwiftType& value);
  static SwiftType toSwift(const AnyJSON& value);
};

} // namespace margelo::nitro
