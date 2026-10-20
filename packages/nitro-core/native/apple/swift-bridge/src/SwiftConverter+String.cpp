//
//  SwiftConverter+String.cpp
//  NitroModules
//

#include <NitroModules/NitroModules-Swift-Cxx-Umbrella.hpp>

#include <NitroModules/SwiftConverter+String.hpp>

namespace margelo::nitro {

std::string SwiftConverter<std::string>::fromSwift(const SwiftType& value) {
  return static_cast<std::string>(value);
}

SwiftConverter<std::string>::SwiftType SwiftConverter<std::string>::toSwift(const std::string& value) {
  // Swift's C++ std::string constructor uses c_str() and would truncate at an embedded null.
  if (value.find('\0') != std::string::npos) {
    return NitroModules::StringUtils::fromUTF8(reinterpret_cast<const uint8_t*>(value.data()),
                                                         static_cast<swift::Int>(value.size()));
  }
  return swift::String(value);
}

} // namespace margelo::nitro
