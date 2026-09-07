//
//  JSICache.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 20.06.24.
//

#pragma once

#include "BorrowingReference.hpp"
#include "NitroLogger.hpp"
#include "WeakReference.hpp"
#include <algorithm>
#include <cstddef>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <unordered_map>
#include <vector>

namespace margelo::nitro {

using namespace facebook;

class JSICacheReference;

/**
 * A `JSICache` can safely store `jsi::Value` instances (e.g. `jsi::Object` or
 * `jsi::Function`) inside `BorrowingReference<T>`.
 *
 * `jsi::Value`s are managed by a `jsi::Runtime`, and will be deleted if the `jsi::Runtime`
 * is deleted - even if there are still strong references to the `jsi::Value`.
 *
 * To access a `BorrowingReference<jsi::Value>` safely, make sure you are using it from
 * the same Thread that it was created on. This ensures that the `jsi::Runtime` cannot
 * delete it while you are still using it.
 */
class JSICache final : public jsi::NativeState {
public:
  ~JSICache();

public:
  JSICache(const JSICache&) = delete;
  JSICache(JSICache&&) = delete;

private:
  JSICache() = default;

public:
  /**
   Gets or creates a `JSICache` for the given `jsi::Runtime`.
   The returned `shared_ptr` should not be stored in
   If it can be locked, you can access data in the cache. Otherwise the Runtime has already been deleted.
   Do not hold the returned `shared_ptr` in memory, only use it in the calling function's scope.
   */
  [[nodiscard]]
  static JSICacheReference getOrCreateCache(jsi::Runtime& runtime);

private:
  friend class JSICacheReference;

public:
  /**
   * A list of weakly-held cache slots that drops dead slots as it grows.
   *
   * Slots were previously only ever appended and freed as a whole in `~JSICache`, so a caller that converts
   * values to JS at a high rate grew these lists without bound for the lifetime of the Runtime, long after the
   * values themselves had been collected.
   *
   * `compact()` only erases slots whose value is definitively deleted (`isDeleted()` - deliberately NOT `lock()`,
   * which materializes a strong reference), so it can never drop a slot `~JSICache` still needs to destroy.
   * The doubling `_compactAt` watermark keeps this amortized O(1) per push, so a cache made mostly of long-lived
   * values does not re-scan on every insert.
   */
  template <typename T>
  class WeakCache final {
  public:
    void push(WeakReference<T>&& reference) {
      if (_references.size() >= _compactAt) [[unlikely]] {
        compact();
      }
      _references.push_back(std::move(reference));
    }

    [[nodiscard]]
    const std::vector<WeakReference<T>>& references() const {
      return _references;
    }

  private:
    void compact() {
      _references.erase(
          std::remove_if(_references.begin(), _references.end(), [](const WeakReference<T>& reference) { return reference.isDeleted(); }),
          _references.end());
      _compactAt = std::max(kMinCompactSize, _references.size() * 2);
    }

  private:
    static inline constexpr size_t kMinCompactSize = 64;

    std::vector<WeakReference<T>> _references;
    size_t _compactAt{kMinCompactSize};
  };

private:
  std::mutex _mutex;
  WeakCache<jsi::Value> _valueCache;
  WeakCache<jsi::Object> _objectCache;
  WeakCache<jsi::Function> _functionCache;
  WeakCache<jsi::WeakObject> _weakObjectCache;
  WeakCache<jsi::PropNameID> _propNameIDCache;
  WeakCache<jsi::ArrayBuffer> _arrayBufferCache;

private:
  static inline std::unordered_map<jsi::Runtime*, std::weak_ptr<JSICache>> _globalCache;

private:
  static constexpr auto TAG = "JSICache";
};

class JSICacheReference final {
public:
  JSICacheReference() = delete;
  JSICacheReference(const JSICacheReference&) = delete;
  JSICacheReference(JSICacheReference&&) = delete;

  ~JSICacheReference() {
    _strongCache->_mutex.unlock();
  }

public:
  BorrowingReference<jsi::Value> makeShared(jsi::Value&& value) {
    BorrowingReference<jsi::Value> owning(new jsi::Value(std::move(value)));
    _strongCache->_valueCache.push(owning.weak());
    return owning;
  }
  BorrowingReference<jsi::Object> makeShared(jsi::Object&& value) {
    BorrowingReference<jsi::Object> owning(new jsi::Object(std::move(value)));
    _strongCache->_objectCache.push(owning.weak());
    return owning;
  }
  BorrowingReference<jsi::Function> makeShared(jsi::Function&& value) {
    BorrowingReference<jsi::Function> owning(new jsi::Function(std::move(value)));
    _strongCache->_functionCache.push(owning.weak());
    return owning;
  }
  BorrowingReference<jsi::WeakObject> makeShared(jsi::WeakObject&& value) {
    BorrowingReference<jsi::WeakObject> owning(new jsi::WeakObject(std::move(value)));
    _strongCache->_weakObjectCache.push(owning.weak());
    return owning;
  }
  BorrowingReference<jsi::PropNameID> makeShared(jsi::PropNameID&& value) {
    BorrowingReference<jsi::PropNameID> owning(new jsi::PropNameID(std::move(value)));
    _strongCache->_propNameIDCache.push(owning.weak());
    return owning;
  }
  BorrowingReference<jsi::ArrayBuffer> makeShared(jsi::ArrayBuffer&& value) {
    BorrowingReference<jsi::ArrayBuffer> owning(new jsi::ArrayBuffer(std::move(value)));
    _strongCache->_arrayBufferCache.push(owning.weak());
    return owning;
  }

private:
  explicit JSICacheReference(const std::shared_ptr<JSICache>& cache) : _strongCache(cache) {
    _strongCache->_mutex.lock();
  }

private:
  std::shared_ptr<JSICache> _strongCache;

  friend class JSICache;
};

} // namespace margelo::nitro
