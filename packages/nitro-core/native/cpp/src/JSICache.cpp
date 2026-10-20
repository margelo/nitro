//
//  JSICache.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 20.06.24.
//

#include <NitroModules/JSICache.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/detail/RuntimeData.hpp>

namespace margelo::nitro {

// Identifies the JSICache in a jsi::Runtime's runtime data.
static constexpr jsi::UUID RUNTIME_DATA_UUID{0x1ea094a6, 0xd2fa, 0x4a79, 0xa00f, 0xb0e8525dfbf7};

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

JSICache::JSICache() {
  Logger::log(LogLevel::Info, TAG, "Creating new JSICache...");
}

JSICache::~JSICache() {
  Logger::log(LogLevel::Info, TAG, "Destroying JSICache...");

  destroyReferences(_valueCache);
  destroyReferences(_objectCache);
  destroyReferences(_functionCache);
  destroyReferences(_weakObjectCache);
  destroyReferences(_propNameIDCache);
  destroyReferences(_arrayBufferCache);
}

JSICache& JSICache::getOrCreateCache(jsi::Runtime& runtime) {
  return detail::RuntimeData::getOrCreate(runtime, RUNTIME_DATA_UUID, [] { return JSICache(); });
}

} // namespace margelo::nitro
