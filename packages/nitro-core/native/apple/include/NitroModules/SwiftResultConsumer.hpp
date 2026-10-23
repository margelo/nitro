#pragma once

#include <NitroModules/NitroDefines.hpp>

namespace margelo::nitro {

/** A synchronous callback that borrows its context and the successful Swift value. */
class SwiftResultConsumer final {
public:
  using Callback = void (*NON_NULL)(void* NON_NULL, const void* NON_NULL) noexcept;

  SwiftResultConsumer(void* NON_NULL context, Callback callback) noexcept : _context(context), _callback(callback) {}

  void call(const void* NON_NULL value) const noexcept {
    _callback(_context, value);
  }

  /**
   * Calls a consumer borrowed through an opaque pointer for the duration of the Swift call.
   * Generated Swift code receives the pointer to keep this type out of exported signatures.
   * TODO: Pass SwiftResultConsumer directly once our minimum Xcode includes
   * https://github.com/swiftlang/swift/pull/93321, which fixes https://github.com/swiftlang/swift/issues/93318.
   */
  static void consume(const void* NON_NULL consumer, const void* NON_NULL value) noexcept {
    static_cast<const SwiftResultConsumer*>(consumer)->call(value);
  }

private:
  void* NON_NULL _context;
  Callback _callback;
};

} // namespace margelo::nitro
