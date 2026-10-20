//
//  SwiftConverter+Optional.hpp
//  NitroModules
//

#pragma once

#include <NitroModules/SwiftConverter.hpp>
#include <optional>

namespace margelo::nitro {

// std::optional<CppElementType> <> swift::Optional<SwiftElementType>
template <typename CppElementType, typename SwiftElementType>
struct SwiftConverter<std::optional<CppElementType>, swift::Optional<SwiftElementType>> {
  using SwiftType = swift::Optional<SwiftElementType>;

  static inline std::optional<CppElementType> fromSwift(const SwiftType& value) {
    if (value.isNone()) {
      return std::nullopt;
    }
    return std::make_optional(SwiftConverter<CppElementType, SwiftElementType>::fromSwift(value.get()));
  }

  static inline SwiftType toSwift(const std::optional<CppElementType>& value) {
    if (!value.has_value()) {
      return SwiftType::none();
    }
    return SwiftType::init(SwiftConverter<CppElementType, SwiftElementType>::toSwift(*value));
  }
};

// Automatically select the Swift optional type from the element's default converter,
// e.g. std::optional<double> -> swift::Optional<double>.
template <SwiftConvertible CppElementType>
struct SwiftConverter<std::optional<CppElementType>> final
    : SwiftConverter<std::optional<CppElementType>, swift::Optional<typename SwiftConverter<CppElementType>::SwiftType>> {};

} // namespace margelo::nitro
