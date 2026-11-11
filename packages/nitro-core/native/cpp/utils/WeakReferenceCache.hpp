//
//  WeakReferenceCache.hpp
//  react-native-nitro
//
//  Created by Patrick Kabwe on 25.08.26.
//

#pragma once

#include "BorrowingReference.hpp"
#include "WeakReference.hpp"
#include <algorithm>
#include <cstddef>
#include <utility>
#include <vector>

namespace margelo::nitro {

/**
 * Holds `WeakReference`s to values that have to be destroyed once their
 * `jsi::Runtime` goes away.
 *
 * A `WeakReference` keeps its `ReferenceState` alive after its value has been
 * destroyed. The cache periodically removes expired references to release that
 * state before Runtime teardown.
 *
 * Compaction runs at geometrically increasing size thresholds instead of on
 * every insert, which keeps `push(...)` amortized O(1). Expired entries can
 * remain until a later insertion reaches the next threshold.
 */
template <typename T>
class WeakReferenceCache final {
public:
  WeakReferenceCache() = default;

  WeakReferenceCache(const WeakReferenceCache&) = delete;
  WeakReferenceCache(WeakReferenceCache&&) = delete;

  void push(WeakReference<T>&& reference) {
    _references.push_back(std::move(reference));
    if (_references.size() >= _nextPruneThreshold) [[unlikely]] {
      pruneExpired();
    }
  }

  void destroyAll() {
    for (const WeakReference<T>& reference : _references) {
      BorrowingReference<T> value = reference.lock();
      if (value != nullptr) {
        value.destroy();
      }
    }
  }

private:
  void pruneExpired() {
    const auto isExpired = [](const WeakReference<T>& reference) {
      return reference.lock() == nullptr;
    };
    _references.erase(std::remove_if(_references.begin(), _references.end(), isExpired), _references.end());
    _nextPruneThreshold = std::max(MIN_PRUNE_BATCH_SIZE, _references.size() * 2);
  }

private:
  // Minimum number of cached weak refs to accumulate before pruning expired
  // entries. This keeps insertion amortized O(1) while bounding retained
  // ReferenceState slack.
  static constexpr std::size_t MIN_PRUNE_BATCH_SIZE = 64;

private:
  std::vector<WeakReference<T>> _references;
  std::size_t _nextPruneThreshold = MIN_PRUNE_BATCH_SIZE;
};

} // namespace margelo::nitro
