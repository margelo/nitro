//
//  JSICache.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 20.06.24.
//

#include "JSICache.hpp"
#include "CommonGlobals.hpp"
#include "JSIHelpers.hpp"
#include "NitroDefines.hpp"
#include "PropNameIDCache.hpp"

namespace margelo::nitro {

template <typename T>
inline void destroyReferences(const std::vector<WeakReference<T>>& references) {
  for (auto& func : references) {
    BorrowingReference<T> reference = func.lock();
    if (reference) {
      // Destroy all functions that we might still have in cache, some callbacks
      // and Promises may now become invalid.
      reference.destroy();
    }
  }
}

JSICache::~JSICache() {
  Logger::log(LogLevel::Info, TAG, "Destroying JSICache...");
  std::unique_lock lock(_mutex);

  PropNameIDCache::clear(_runtime);
  {
    std::lock_guard globalCacheLock(_globalCacheMutex);
    _globalCache.erase(&_runtime);
  }

  destroyReferences(_valueCache);
  destroyReferences(_objectCache);
  destroyReferences(_functionCache);
  destroyReferences(_weakObjectCache);
  destroyReferences(_propNameIDCache);
  destroyReferences(_arrayBufferCache);
}

JSICacheReference JSICache::getOrCreateCache(jsi::Runtime& runtime) {
  std::shared_ptr<JSICache> cached;
  {
    std::lock_guard globalCacheLock(_globalCacheMutex);
    auto found = _globalCache.find(&runtime);
    if (found != _globalCache.end()) [[likely]] {
      // Fast path: get weak_ptr to JSICache from our global list.
      cached = found->second.lock();
    }
  }
  if (cached) [[likely]] {
    // It's still alive! Return it
    return JSICacheReference(cached);
  }

  // Cache doesn't exist yet.
  Logger::log(LogLevel::Info, TAG, "Creating new JSICache<T> for runtime %s..", getRuntimeId(runtime).c_str());
  // Create new cache
  std::shared_ptr<JSICache> nativeState(new JSICache(runtime));
  // Wrap it in a jsi::Value using NativeState
  jsi::Object cache(runtime);
  cache.setNativeState(runtime, nativeState);
  // Add it to our map of caches first, because the next `::defineGlobal(...)`
  // call will already be using it (recursively)
  {
    std::lock_guard globalCacheLock(_globalCacheMutex);
    _globalCache[&runtime] = nativeState;
  }
  try {
    // Call Object.defineProperty(global, ...) now with our cache (it internally
    // already uses cache)
    CommonGlobals::defineGlobal(runtime, KnownGlobalPropertyName::JSI_CACHE, std::move(cache));
  } catch (...) {
    // If `defineGlobal(...)` failed, we should remove it from `_globalCache` so
    // we don't have invalid caches.
    std::lock_guard globalCacheLock(_globalCacheMutex);
    _globalCache.erase(&runtime);
    throw;
  }
  // Return it
  return JSICacheReference(nativeState);
}

} // namespace margelo::nitro
