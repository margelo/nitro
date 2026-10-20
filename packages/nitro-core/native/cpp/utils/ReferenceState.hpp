//
//  ReferenceState.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 03.02.24.
//

#pragma once

#include <atomic>
#include <mutex>

namespace margelo::nitro {

/**
 * Holds state for an `BorrowingReference` (or `WeakReference`).
 *
 * The state tracks the amount of strong- and weak- references to any kind of value,
 * including an extra `isDeleted` flag that specifies whether the value has been force-deleted.
 *
 * Also, a `mutex` allows for thread-safe access of the `isDeleted` flag.
 */
struct ReferenceState {
  std::atomic_size_t strongRefCount;
  std::atomic_size_t weakRefCount;
  std::atomic<bool> isDeleted;
  std::mutex mutex;

  /**
   * Decrements the strong ref count by one, and returns whether the value should be deleted.
   */
  inline bool decrementStrongRefCount() {
    size_t oldRefCount = strongRefCount.fetch_sub(1);
    return oldRefCount <= 1;
  }

  explicit ReferenceState() : strongRefCount(1), weakRefCount(0), isDeleted(false) {}
};

} // namespace margelo::nitro
