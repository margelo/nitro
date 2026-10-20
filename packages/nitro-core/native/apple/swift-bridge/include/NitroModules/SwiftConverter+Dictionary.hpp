#pragma once

#include <NitroModules/SwiftConverter.hpp>

namespace margelo::nitro {

// Swift Dictionary's Hashable constraint is not exported to C++. Nitrogen
// supplies a concrete facade, while element conversion stays in this template.
template <typename Map, typename Dictionary, typename SwiftKey, typename SwiftValue>
struct SwiftDictionaryConverter {
  using SwiftType = Dictionary;
  using KeyConverter = SwiftConverter<typename Map::key_type, SwiftKey>;
  using ValueConverter = SwiftConverter<typename Map::mapped_type, SwiftValue>;

  static Map fromSwift(const SwiftType& value) {
    Map result;
    auto cursor = value.makeCursor();
    auto key = swift::Optional<typename KeyConverter::SwiftType>::none();
    auto element = swift::Optional<typename ValueConverter::SwiftType>::none();
    while (cursor.next(key, element)) {
      result.emplace(KeyConverter::fromSwift(key.get()), ValueConverter::fromSwift(element.get()));
    }
    return result;
  }

  static SwiftType toSwift(const Map& value) {
    auto result = SwiftType::init(static_cast<swift::Int>(value.size()));
    for (const auto& [key, element] : value) {
      result.set(KeyConverter::toSwift(key), ValueConverter::toSwift(element));
    }
    return result;
  }
};

} // namespace margelo::nitro
