//
//  WeakReference.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 21.06.24.
//

#pragma once

#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/detail/ReferenceState.hpp>
#include <atomic>
#include <cstddef>
#include <mutex>

namespace margelo::nitro {

// forward-declaration to avoid duplicate symbols
template <typename T>
class BorrowingReference;

/**
 A `WeakReference<T>` is a weak reference to a pointer created by `BorrowingReference<T>`.
 It can be locked to gain a strong `BorrowingReference<T>` again if it has not been deleted yet.
 */
template <typename T>
class WeakReference final {
private:
  explicit WeakReference(const BorrowingReference<T>& ref);

public:
  WeakReference() : _value(nullptr), _state(nullptr) {}

  WeakReference(const WeakReference& ref) : _value(ref._value), _state(ref._state) {
    if (_state != nullptr) {
      // increment ref count after copy
      _state->weakRefCount++;
    }
  }

  WeakReference(WeakReference&& ref) noexcept : _value(ref._value), _state(ref._state) {
    // Remove state from other WeakReference after moving since it's now stale data
    ref._value = nullptr;
    ref._state = nullptr;
  }

  WeakReference& operator=(WeakReference&& ref) noexcept {
    if (this == &ref)
      return *this;

    if (_state != nullptr) {
      release();
    }

    _value = ref._value;
    _state = ref._state;
    ref._value = nullptr;
    ref._state = nullptr;

    return *this;
  }

  WeakReference& operator=(const WeakReference& ref) {
    if (this == &ref)
      return *this;

    if (_state != nullptr) {
      // destroy previous pointer
      release();
    }

    _value = ref._value;
    _state = ref._state;
    if (_state != nullptr) {
      // increment new pointer
      _state->weakRefCount++;
    }

    return *this;
  }

  ~WeakReference() {
    if (_state != nullptr) {
      release();
    }
  }

  /**
   * Try to lock the weak reference to a borrowing reference, or an empty reference if this weak reference is empty
   * or the value has already been deleted.
   */
  [[nodiscard]]
  BorrowingReference<T> lock() const;

  /**
   * Get whether the value this weak reference points to has already been deleted, or whether this weak reference is empty.
   * If this returns `true` for a non-empty weak reference, `lock()` will never return a value again.
   */
  [[nodiscard]]
  bool isExpired() const noexcept {
    return _state == nullptr || _state->isDeleted;
  }

public:
  friend class BorrowingReference<T>;

private:
  void release() {
    if (_state->decrementWeakRefCount()) {
      // free the full memory if there are no more references at all.
      // the strong references share one weak reference, so the value has already been deleted at this point.
      delete _state;
    }
    _state = nullptr;
  }

private:
  T* NULLABLE _value;
  detail::ReferenceState* NULLABLE _state;
};

} // namespace margelo::nitro
