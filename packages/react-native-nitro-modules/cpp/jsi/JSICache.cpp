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

// Guards `_globalCache`. Different Runtimes call `getOrCreateCache` from their own
// Threads concurrently (RN JS thread + Worklet Runtimes), and un-synchronized
// `unordered_map` access is UB - a racy `find` miss creates a DUPLICATE cache for a
// live Runtime, and `defineGlobal` silently replaces `__nitroJsiCache` in release,
// so the orphaned cache gets GC'd and force-destroys every `jsi::Function` created
// through it ("the underlying `jsi::Function` has already been deleted!").
// Never held across any JSI call (`getOrCreateCache` is re-entrant via `defineGlobal`).
static std::mutex g_globalCacheMutex;

template <typename T>
inline void destroyReferences(const std::vector<WeakReference<T>>& references) {
  for (auto& func : references) {
    BorrowingReference<T> reference = func.lock();
    if (reference) {
      // Destroy all functions that we might still have in cache, some callbacks and Promises may now become invalid.
      reference.destroy();
    }
  }
}

JSICache::~JSICache() {
  Logger::log(LogLevel::Info, TAG, "Destroying JSICache...");
  std::unique_lock lock(_mutex);

  destroyReferences(_valueCache);
  destroyReferences(_objectCache);
  destroyReferences(_functionCache);
  destroyReferences(_weakObjectCache);
  destroyReferences(_propNameIDCache);
  destroyReferences(_arrayBufferCache);
}

JSICacheReference JSICache::getOrCreateCache(jsi::Runtime& runtime) {
  bool hadStaleEntry = false;
  {
    std::unique_lock lock(g_globalCacheMutex);
    auto found = _globalCache.find(&runtime);
    if (found != _globalCache.end()) [[likely]] {
      // Fast path: get weak_ptr to JSICache from our global list.
      std::weak_ptr<JSICache> weak = found->second;
      std::shared_ptr<JSICache> strong = weak.lock();
      if (strong) {
        // It's still alive! Return it
        // (JSICacheReference locks the instance mutex - taken after dropping the static lock is fine,
        //  the shared_ptr keeps the cache alive either way. Lock order stays static -> instance.)
        lock.unlock();
        return JSICacheReference(strong);
      }
      hadStaleEntry = true;
    }
  }
  if (hadStaleEntry) {
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
  {
    std::unique_lock lock(g_globalCacheMutex);
    _globalCache[&runtime] = nativeState;
  }
  try {
    // Call Object.defineProperty(global, ...) now with our cache (it internally already uses cache)
    CommonGlobals::defineGlobal(runtime, KnownGlobalPropertyName::JSI_CACHE, std::move(cache));
  } catch (...) {
    // If `defineGlobal(...)` failed, we should remove it from `_globalCache` so we don't have invalid caches.
    std::unique_lock lock(g_globalCacheMutex);
    _globalCache.erase(&runtime);
    throw;
  }
  // Return it
  return JSICacheReference(nativeState);
}

} // namespace margelo::nitro
