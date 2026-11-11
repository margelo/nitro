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
      _state->weakRefCount--;
      maybeDestroy();
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
      _state->weakRefCount--;
      maybeDestroy();
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
      _state->weakRefCount--;
      maybeDestroy();
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
  void maybeDestroy() {
    if (_state->strongRefCount == 0 && _state->weakRefCount == 0) {
      // free the full memory if there are no more references at all
      if (!_state->isDeleted) [[unlikely]] {
        std::string typeName = TypeInfo::getFriendlyTypename<T>(true);
        throw std::runtime_error("WeakReference<" + typeName + "> encountered a stale `_value` - BorrowingReference<" + typeName +
                                 "> should've already deleted this!");
      }
      delete _state;
      _state = nullptr;
    }
  }

private:
  T* NULLABLE _value;
  ReferenceState* NON_NULL _state;
};

} // namespace margelo::nitro
