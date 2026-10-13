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
std::unordered_map<jsi::Runtime*, PropNameIDCache::BatchMap> PropNameIDCache::_batchCache;
std::mutex PropNameIDCache::_batchMutex;

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

bool PropNameIDCache::Batch::isValid() const {
  // All names are registered with the same JSICache. They are invalidated as
  // one group during runtime teardown, so one sentinel avoids a per-field
  // validity scan on the warm path.
  return _names.empty() || _names.front() != nullptr;
}

std::shared_ptr<void> PropNameIDCache::Batch::lockCacheLifetime() const {
  return _cacheLifetime.lock();
}

PropNameIDCache::BatchHandle PropNameIDCache::getBatch(jsi::Runtime& runtime, const void* key, std::span<const std::string_view> names) {
  {
    std::lock_guard lock(_batchMutex);
    BatchMap& cache = _batchCache[&runtime];
    const auto cachedBatch = cache.find(key);
    if (cachedBatch != cache.end() && cachedBatch->second->isValid()) {
      std::shared_ptr<void> cacheLifetime = cachedBatch->second->lockCacheLifetime();
      if (cacheLifetime) {
        return BatchHandle(cachedBatch->second.get(), std::move(cacheLifetime));
      }
    }
  }

  // Keep this cache reference in the setup scope only. In particular, it must
  // not stay locked while generated converters access getters or Proxy traps.
  std::shared_ptr<void> cacheLifetime;
  std::unique_ptr<Batch> batch;
  {
    JSICacheReference jsiCache = JSICache::getOrCreateCache(runtime);
    std::vector<BorrowingReference<jsi::PropNameID>> propertyNames;
    propertyNames.reserve(names.size());
    for (const std::string_view name : names) {
      propertyNames.emplace_back(jsiCache.makeShared(jsi::PropNameID::forAscii(runtime, name.data(), name.size())));
    }
    cacheLifetime = jsiCache.getLifetimeToken();
    batch = std::unique_ptr<Batch>(new Batch(std::move(propertyNames), cacheLifetime));
  }

  // A Batch is heap-owned, so map rehashes caused by re-entrant conversions do
  // not invalidate the returned reference. Runtime teardown invalidates its
  // BorrowingReferences through JSICache; an address-reused runtime recreates
  // the Batch on the next lookup.
  std::lock_guard lock(_batchMutex);
  BatchMap& cache = _batchCache[&runtime];
  const auto cachedBatch = cache.find(key);
  if (cachedBatch != cache.end() && cachedBatch->second->isValid()) {
    std::shared_ptr<void> cachedLifetime = cachedBatch->second->lockCacheLifetime();
    if (cachedLifetime) {
      return BatchHandle(cachedBatch->second.get(), std::move(cachedLifetime));
    }
  }
  const Batch* result = batch.get();
  cache.insert_or_assign(key, std::move(batch));
  return BatchHandle(result, std::move(cacheLifetime));
}

void PropNameIDCache::clear(jsi::Runtime& runtime) {
  std::lock_guard lock(_batchMutex);
  _batchCache.erase(&runtime);
}

} // namespace margelo::nitro
