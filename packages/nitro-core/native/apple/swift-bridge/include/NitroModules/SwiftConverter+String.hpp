//
//  SwiftConverter+String.hpp
//  NitroModules
//

#pragma once

#include <NitroModules/SwiftConverter.hpp>
#include <string>

namespace margelo::nitro {

// std::string <> swift::String (counted UTF-8, preserving embedded nulls)
template <>
struct SwiftConverter<std::string> final {
  using SwiftType = swift::String;

  static std::string fromSwift(const SwiftType& value);
  static SwiftType toSwift(const std::string& value);
};

} // namespace margelo::nitro
