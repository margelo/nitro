//
//  WeakReference.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 21.06.24.
//

#pragma once

#include "NitroDefines.hpp"
#include "ReferenceState.hpp"
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

  WeakReference(WeakReference&& ref) : _value(ref._value), _state(ref._state) {
    // Remove state from other WeakReference after moving since it's now stale data
    ref._value = nullptr;
    ref._state = nullptr;
  }

  WeakReference& operator=(WeakReference&& ref) noexcept {
    if (this == &ref)
      return *this;

    if (_state != nullptr) {
      releaseWeakRef();
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
      releaseWeakRef();
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
      releaseWeakRef();
    }
  }

  /**
   * Try to lock the weak reference to a borrowing reference, or `nullptr` if it has already been deleted.
   */
  [[nodiscard]]
  BorrowingReference<T> lock() const;

public:
  friend class BorrowingReference<T>;

private:
  // Releases this weak reference's count on the state, freeing the state if it was the last reference overall.
  // The strong cohort owns one implicit weak reference (see `ReferenceState`), so the count can only reach zero
  // after the final strong release already destroyed the value, and `fetch_sub`'s return value alone decides
  // who frees the state.
  void releaseWeakRef() {
    if (_state->weakRefCount.fetch_sub(1) == 1) {
      delete _state;
    }
    _state = nullptr;
  }

private:
  T* NULLABLE _value;
  ReferenceState* NON_NULL _state;
};

} // namespace margelo::nitro
