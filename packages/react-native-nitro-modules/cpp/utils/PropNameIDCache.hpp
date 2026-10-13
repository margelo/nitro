//
//  PropNameIDCache.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 17.10.25.
//

#pragma once

#include "BorrowingReference.hpp"
#include <cstddef>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <span>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace margelo::nitro {

using namespace facebook;

class JSICache;

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
   * A prepared, runtime-local set of property names. The set only caches
   * `jsi::PropNameID`s, never JavaScript property values.
   */
  class Batch final {
  public:
    const jsi::PropNameID& operator[](size_t index) const {
      return *_names[index];
    }

  private:
    Batch(std::vector<BorrowingReference<jsi::PropNameID>>&& names, std::weak_ptr<void>&& cacheLifetime)
        : _names(std::move(names)), _cacheLifetime(std::move(cacheLifetime)) {}

    bool isValid() const;
    std::shared_ptr<void> lockCacheLifetime() const;

  private:
    std::vector<BorrowingReference<jsi::PropNameID>> _names;
    std::weak_ptr<void> _cacheLifetime;

    friend class PropNameIDCache;
  };

  /**
   * Keeps the Batch and its JSICache alive for one generated conversion. This
   * protects names if a getter re-enters JavaScript and removes the global
   * JSICache object before the conversion has read its remaining properties.
   */
  class BatchHandle final {
  public:
    BatchHandle(const BatchHandle&) = delete;
    BatchHandle(BatchHandle&&) = default;

    const jsi::PropNameID& operator[](size_t index) const {
      return (*_batch)[index];
    }

  private:
    BatchHandle(const Batch* batch, std::shared_ptr<void> cacheLifetime) : _cacheLifetime(std::move(cacheLifetime)), _batch(batch) {}

  private:
    std::shared_ptr<void> _cacheLifetime;
    const Batch* _batch;

    friend class PropNameIDCache;
  };

  /**
   * Get the property-name set identified by `key` for this runtime.
   *
   * `key` must identify static, process-lifetime name metadata. The returned
   * set is valid for the current synchronous runtime call and does not hold a
   * cache lock while JavaScript properties are accessed.
   */
  static BatchHandle getBatch(jsi::Runtime& runtime, const void* key, std::span<const std::string_view> names);

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
  using BatchMap = std::unordered_map<const void*, std::unique_ptr<Batch>>;

  static std::unordered_map<jsi::Runtime*, CacheMap> _cache;
  static std::unordered_map<jsi::Runtime*, BatchMap> _batchCache;
  static std::mutex _batchMutex;

  static void clear(jsi::Runtime& runtime);

  friend class JSICache;
};

} // namespace margelo::nitro
