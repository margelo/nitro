//
//  WeakReference+Borrowing.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 23.06.24.
//

#pragma once

#include "BorrowingReference.hpp"

namespace margelo::nitro {

template <typename T>
WeakReference<T>::WeakReference(const BorrowingReference<T>& ref) {
  _value = ref._value;
  _state = ref._state;
  _state->weakRefCount++;
}

template <typename T>
BorrowingReference<T> WeakReference<T>::lock() const {
  std::unique_lock lock(_state->mutex);

  if (_state->isDeleted) {
    // return nullptr
    return BorrowingReference<T>();
  }
  if (!_state->tryIncrementStrongRefCount()) {
    // the last strong reference is mid-release - the value is about to be destroyed, it just hasn't
    // flagged `isDeleted` yet.
    return BorrowingReference<T>();
  }

  return BorrowingReference(*this);
}

} // namespace margelo::nitro
