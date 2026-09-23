//
//  PropNameIDCache.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 17.10.25.
//

#include "PropNameIDCache.hpp"
#include "JSICache.hpp"
#include <mutex>

namespace margelo::nitro {

using namespace facebook;

std::unordered_map<jsi::Runtime*, PropNameIDCache::CacheMap> PropNameIDCache::_cache;

// Guards the OUTER `_cache` map only - `operator[]` inserts, and concurrent
// insertion/rehash from different Runtimes' Threads is UB. The inner per-Runtime
// `CacheMap` is only ever accessed from that Runtime's own Thread, and
// `unordered_map` value references stay valid across rehash, so the reference can
// be used lock-free after acquisition.
static std::mutex g_cacheMutex;

const jsi::PropNameID& PropNameIDCache::get(jsi::Runtime& runtime, const std::string& value) {
  CacheMap* cachePtr;
  {
    std::unique_lock lock(g_cacheMutex);
    cachePtr = &_cache[&runtime];
  }
  CacheMap& cache = *cachePtr;
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
