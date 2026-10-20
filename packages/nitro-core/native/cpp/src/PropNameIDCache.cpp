//
//  PropNameIDCache.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 17.10.25.
//

#include <NitroModules/PropNameIDCache.hpp>
#include <NitroModules/detail/RuntimeData.hpp>

namespace margelo::nitro {

using namespace facebook;

// Identifies the PropNameIDCache in a jsi::Runtime's runtime data.
static constexpr jsi::UUID RUNTIME_DATA_UUID{0x7836f9bb, 0x6a55, 0x49dd, 0xb80b, 0xc640af1d17ce};

const jsi::PropNameID& PropNameIDCache::get(jsi::Runtime& runtime, const std::string& value) {
  CacheMap& cache = detail::RuntimeData::getOrCreate(runtime, RUNTIME_DATA_UUID, [] { return CacheMap(); });
  const auto& cachedName = cache.find(value);
  if (cachedName != cache.end()) {
    // cache warm!
    return cachedName->second;
  }

  // not cached - create the jsi::PropNameID and store it in cache...
  auto inserted = cache.emplace(value, jsi::PropNameID::forUtf8(runtime, value));

  // return it!
  return inserted.first->second;
}

} // namespace margelo::nitro
