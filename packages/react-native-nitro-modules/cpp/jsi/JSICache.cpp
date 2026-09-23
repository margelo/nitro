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

namespace margelo::nitro {

JSICache::~JSICache() {
  Logger::log(LogLevel::Info, TAG, "Destroying JSICache...");
  std::unique_lock lock(_mutex);

  // Some callbacks and Promises may now become invalid.
  _valueCache.destroyAll();
  _objectCache.destroyAll();
  _functionCache.destroyAll();
  _weakObjectCache.destroyAll();
  _propNameIDCache.destroyAll();
  _arrayBufferCache.destroyAll();
}

JSICacheReference JSICache::getOrCreateCache(jsi::Runtime& runtime) {
  auto found = _globalCache.find(&runtime);
  if (found != _globalCache.end()) [[likely]] {
    // Fast path: get weak_ptr to JSICache from our global list.
    std::weak_ptr<JSICache> weak = found->second;
    std::shared_ptr<JSICache> strong = weak.lock();
    if (strong) {
      // It's still alive! Return it
      return JSICacheReference(strong);
    }
    Logger::log(LogLevel::Warning, TAG, "JSICache was created, but it is no longer strong!");
  }

  // Cache doesn't exist yet.
  Logger::log(LogLevel::Info, TAG, "Creating new JSICache<T> for runtime %s..", getRuntimeId(runtime).c_str());
  // Create new cache
  std::shared_ptr<JSICache> nativeState(new JSICache());
  // Wrap it in a jsi::Value using NativeState
  jsi::Object cache(runtime);
  cache.setNativeState(runtime, nativeState);
  // Add it to our map of caches first, because the next `::defineGlobal(...)` call will already be using it (recursively)
  _globalCache[&runtime] = nativeState;
  try {
    // Call Object.defineProperty(global, ...) now with our cache (it internally already uses cache)
    CommonGlobals::defineGlobal(runtime, KnownGlobalPropertyName::JSI_CACHE, std::move(cache));
  } catch (...) {
    // If `defineGlobal(...)` failed, we should remove it from `_globalCache` so we don't have invalid caches.
    _globalCache.erase(&runtime);
    throw;
  }
  // Return it
  return JSICacheReference(nativeState);
}

} // namespace margelo::nitro
