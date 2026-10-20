//
//  SwiftConverter+Array.hpp
//  NitroModules
//

#pragma once

#include <NitroModules/SwiftConverter.hpp>
#include <vector>

namespace margelo::nitro {

// std::vector<CppElementType> <> swift::Array<SwiftElementType>
template <typename CppElementType, typename SwiftElementType>
struct SwiftConverter<std::vector<CppElementType>, swift::Array<SwiftElementType>> {
  using SwiftType = swift::Array<SwiftElementType>;

  static inline std::vector<CppElementType> fromSwift(const SwiftType& value) {
    auto length = value.getCount();
    std::vector<CppElementType> result;
    result.reserve(static_cast<size_t>(length));
    for (swift::Int i = 0; i < length; ++i) {
      result.emplace_back(SwiftConverter<CppElementType, SwiftElementType>::fromSwift(value[i]));
    }
    return result;
  }

  static inline SwiftType toSwift(const std::vector<CppElementType>& value) {
    auto result = SwiftType::init();
    result.reserveCapacity(static_cast<swift::Int>(value.size()));
    for (const auto& element : value) {
      result.append(SwiftConverter<CppElementType, SwiftElementType>::toSwift(element));
    }
    return result;
  }
};

// Automatically select the Swift array type from the element's default converter,
// e.g. std::vector<double> -> swift::Array<double>.
template <SwiftConvertible CppElementType>
struct SwiftConverter<std::vector<CppElementType>> final
    : SwiftConverter<std::vector<CppElementType>, swift::Array<typename SwiftConverter<CppElementType>::SwiftType>> {};

} // namespace margelo::nitro
