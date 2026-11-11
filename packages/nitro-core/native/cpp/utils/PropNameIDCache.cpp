//
//  PropNameIDCache.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 17.10.25.
//

#include "PropNameIDCache.hpp"
#include "JSICache.hpp"

namespace margelo::nitro {

using namespace facebook;

std::unordered_map<jsi::Runtime*, PropNameIDCache::CacheMap> PropNameIDCache::_cache;

const jsi::PropNameID& PropNameIDCache::get(jsi::Runtime& runtime, const std::string& value) {
  CacheMap& cache = _cache[&runtime];
  const auto& cachedName = cache.find(value);
  if (cachedName != cache.end()) {
    // cache warm!
    const BorrowingReference<jsi::PropNameID>& value = cachedName->second;
    if (value != nullptr) {
      // Reference is still alive - return it.
      return *value;
    }
    // Reference is dead (e.g. runtime was recreated), re-create it.
  }

  // not cached - create the jsi::PropNameID...
  auto propName = jsi::PropNameID::forAscii(runtime, value);
  auto jsiCache = JSICache::getOrCreateCache(runtime);
  auto sharedPropName = jsiCache.makeShared(std::move(propName));

  // store it in cache...
  cache.insert_or_assign(value, sharedPropName);

  // return it!
  return *sharedPropName;
}

} // namespace margelo::nitro
