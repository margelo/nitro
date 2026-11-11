//
//  PropNameIDCache.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 17.10.25.
//

#pragma once

#include "BorrowingReference.hpp"
#include <jsi/jsi.h>
#include <unordered_map>

namespace margelo::nitro {

using namespace facebook;

/**
 * Allows caching `jsi::PropNameID`s via `std::string`s.
 * The returned `jsi::PropNameID` can be used for JSI operations like
 * - `jsi::Object::getProperty(...)`
 * - `jsi::Object::setProperty(...)`
 * - `jsi::Object::hasProperty(...)`
 * And is more efficient than the string equivalent overloads of those
 * functions due to caching.
 */
class PropNameIDCache final {
public:
  PropNameIDCache() = delete;
  ~PropNameIDCache() = delete;

  /**
   * Get a `jsi::PropNameID` for the given `std::string` value.
   * - The `std::string` must be an ASCII string.
   * - The `jsi::PropNameID` is only valid within the callee's current
   *   synchronous scope, and must be non-escaping.
   */
  static const jsi::PropNameID& get(jsi::Runtime& runtime, const std::string& value);

  /**
   * Get a list of `jsi::PropNameID`s for the given strings.
   * Useful for `jsi::HostObject::getPropertyNames(...)`.
   */
  static std::vector<jsi::PropNameID> names(jsi::Runtime& runtime, const std::string& first, auto&&... rest) {
    std::vector<jsi::PropNameID> out;
    out.reserve(1 + sizeof...(rest));
    out.emplace_back(runtime, PropNameIDCache::get(runtime, first));
    (out.emplace_back(runtime, PropNameIDCache::get(runtime, std::forward<decltype(rest)>(rest))), ...);
    return out;
  }

private:
  using CacheMap = std::unordered_map<std::string, BorrowingReference<jsi::PropNameID>>;
  static std::unordered_map<jsi::Runtime*, CacheMap> _cache;
};

} // namespace margelo::nitro
