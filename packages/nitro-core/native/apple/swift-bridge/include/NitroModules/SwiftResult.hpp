#pragma once

#include <NitroModules/Result.hpp>
#include <NitroModules/SwiftResultConsumer.hpp>
#include <cstddef>
#include <memory>
#include <new>
#include <optional>
#include <stdexcept>
#include <type_traits>
#include <utility>

// The consuming translation unit includes the compiler-generated Swift definitions.
#ifndef SWIFT_SWIFT_H
#error Include your generated -Swift.h header before SwiftResult.hpp.
#endif

namespace margelo::nitro {

namespace detail {
  template <typename T>
  inline constexpr bool isSwiftResultStatus = false;

  template <typename OwnerTag>
  inline constexpr bool isSwiftResultStatus<Result<void, OwnerTag>> = true;

  template <typename T>
  inline constexpr bool isResult = false;

  template <typename T, typename OwnerTag>
  inline constexpr bool isResult<Result<T, OwnerTag>> = true;

  /** Aligned storage for one T that Swift may initialize; destroys T only once initialized. */
  template <typename T>
  struct CxxValueStorage {
    alignas(T) std::byte bytes[sizeof(T)];
    bool initialized = false;

    T* get() {
      return std::launder(reinterpret_cast<T*>(bytes));
    }

    ~CxxValueStorage() {
      if (initialized) {
        std::destroy_at(get());
      }
    }
  };
} // namespace detail

// Imported C++ records use their native layout, so these helpers do not need Swift
// generic metadata. Generated code uses them to keep the records out of exported Swift
// signatures, which otherwise specialize the same generic traits in several -Swift.h headers.
// TODO: Remove once our minimum Xcode includes https://github.com/swiftlang/swift/pull/93321,
// which fixes https://github.com/swiftlang/swift/issues/93318.

/** Calls a Swift initializer with aligned native C++ storage and moves out T. */
template <typename T, typename Initializer>
T makeCxxValue(Initializer&& initializer) {
  detail::CxxValueStorage<T> storage;
  initializer(storage.bytes);
  storage.initialized = true;
  return std::move(*storage.get());
}

/** A failed Swift initializer leaves native C++ storage uninitialized. */
template <typename T, typename Initializer>
  requires detail::isSwiftResultStatus<std::invoke_result_t<Initializer&, void*>>
Result<T> withCxxResult(Initializer&& initializer) {
  detail::CxxValueStorage<T> storage;
  auto status = initializer(storage.bytes);
  if (status.hasError()) [[unlikely]] {
    return Result<T>::withError(status.error());
  }
  storage.initialized = true;
  return Result<T>::withValue(std::move(*storage.get()));
}

/**
 * Calls initializer with Swift-owned storage for T. The initializer returns
 * Result<void, OwnerTag> and initializes T through the pointer only on success.
 * On success, the initialized value is transferred into Result<T>.
 */
template <typename T, typename Initializer>
  requires detail::isSwiftResultStatus<std::invoke_result_t<Initializer&, void*>>
Result<T> withSwiftResult(Initializer&& initializer) {
  using Status = std::invoke_result_t<Initializer&, void*>;
  auto status = Status::withValue();
  auto value = NitroModules::tryMakeSwiftValue<T>([&](void* storage) {
    try {
      status = initializer(storage);
    } catch (...) {
      // We have to catch & extract the C++ exception here because we're
      // still in a Swift stack frame, and throwing here would crash as Swift
      // cannot catch C++ exceptions yet.
      status = Status::withError(std::current_exception());
    }
    return status.hasValue();
  });
  if (status.hasError()) [[unlikely]] {
    return Result<T>::withError(status.error());
  }
  return Result<T>::withValue(value.get());
}

/**
 * Calls invocation with an opaque pointer to a SwiftResultConsumer. On success, Swift lends
 * its value to the consumer, which copies it into Result<T>. Unlike withSwiftResult(), no
 * swift::Optional<T> crosses the boundary, so a successful call does not allocate a box for it.
 */
template <typename T, typename Invocation>
  requires detail::isSwiftResultStatus<std::invoke_result_t<Invocation&, const void*>>
Result<T> receiveSwiftResult(Invocation&& invocation) {
  std::optional<Result<T>> result;
  SwiftResultConsumer consumer(&result, [](void* raw, const void* value) noexcept {
    auto& context = *static_cast<std::optional<Result<T>>*>(raw);
    try {
      context.emplace(Result<T>::withValue(NitroModules::copySwiftValue<T>(value)));
    } catch (...) {
      // We are still in the Swift frame that lends value, and Swift
      // cannot catch C++ exceptions yet, so keep the error for later.
      context.emplace(Result<T>::withError(std::current_exception()));
    }
  });
  auto status = invocation(static_cast<const void*>(&consumer));
  if (result && result->hasError()) [[unlikely]] {
    return std::move(*result);
  }
  if (status.hasError()) [[unlikely]] {
    return Result<T>::withError(status.error());
  }
#ifdef NITRO_DEBUG
  if (!result) [[unlikely]] {
    throw std::runtime_error("A successful Swift call did not provide its return value!");
  }
#endif
  return std::move(result.value());
}

/**
 * Calls body with a pointer to value's Swift representation and returns
 * body's Result. The pointer is only valid during the call. C++ exceptions
 * thrown by body become the Result's error, because they must not unwind
 * through the Swift frame that borrows value.
 */
template <typename T, typename Body>
  requires detail::isResult<std::invoke_result_t<Body&, const void*>>
std::invoke_result_t<Body&, const void*> borrowSwiftValue(const T& value, Body&& body) {
  using R = std::invoke_result_t<Body&, const void*>;
  std::optional<R> result;
  NitroModules::withSwiftValue(value, [&](const void* pointer) {
    try {
      result.emplace(body(pointer));
    } catch (...) {
      result.emplace(R::withError(std::current_exception()));
    }
  });
  return std::move(*result);
}

} // namespace margelo::nitro
