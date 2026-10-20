//
//  ArrayBuffer.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

namespace margelo::nitro {
template <typename T>
struct JSIConverter;
} // namespace margelo::nitro

#include <NitroModules/BorrowingReference.hpp>
#include <NitroModules/Dispatcher.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <functional>
#include <jsi/jsi.h>
#include <memory>

namespace margelo::nitro {

using namespace facebook;

using DeleteFn = std::function<void()>;
class JSArrayBuffer;
using NativeArrayBuffer = std::shared_ptr<jsi::MutableBuffer>;

class ArrayBuffer;

/**
 * Represents a JS-based `ArrayBuffer`.
 *
 * While its underlying data might have been allocated on the native side (`NativeArrayBuffer`),
 * we only have a JS reference to the `ArrayBuffer` object so it is considered a "borrowed"-resource.
 *
 * `data()` and `size()` can only be accessed synchronously on the JS Runtime Thread.
 * If you want to access it elsewhere, copy the buffer first.
 *
 * If the JS ArrayBuffer (or its JS Runtime) have already been deleted, `data()` returns `nullptr`.
 */
class JSArrayBuffer final {
  friend JSIConverter<ArrayBuffer>;
public:
  explicit JSArrayBuffer(jsi::Runtime& runtime, BorrowingReference<jsi::ArrayBuffer>&& jsReference);
  JSArrayBuffer(const JSArrayBuffer&) = default;
  JSArrayBuffer(JSArrayBuffer&&) = default;
  JSArrayBuffer& operator=(const JSArrayBuffer&) = default;
  JSArrayBuffer& operator=(JSArrayBuffer&&) = default;
  bool operator==(const JSArrayBuffer& other) const;
  ~JSArrayBuffer() = default;

public:
  uint8_t* NULLABLE data() const [[clang::lifetimebound]];
  size_t size() const;

  NativeArrayBuffer asOwning() const;

private:
  std::reference_wrapper<jsi::Runtime> _runtime;
  BorrowingReference<jsi::ArrayBuffer> _jsReference;
#ifdef NITRO_DEBUG
  std::weak_ptr<Dispatcher> _dispatcher;
#endif
};

/**
 * Represents a raw byte buffer that can be read from-, and
 * written to- from both JavaScript and C++.
 * `ArrayBuffer` is not thread-safe and does not lock multi-thread access.
 *
 * `ArrayBuffer` can either be a `JSArrayBuffer`, or a `NativeArrayBuffer`.
 * - `NativeArrayBuffer`: Retains its storage lifetime (`isOwner()`), including views that retain another owner.
 * - `JSArrayBuffer`: Received from JS, and its storage lifetime depends on the JS Runtime and reference remaining valid.
 *
 * Native copies share ownership: storage stays alive until the last owner releases it.
 * Owning does not require freeing the bytes directly; a view can retain its backing storage's owner.
 * JS-backed buffers borrow their storage lifetime. Call `asOwning()` on the JS Runtime Thread
 * to retain the native backing storage, or copy the bytes if that is not possible.
 */
class ArrayBuffer final {
  friend JSIConverter<ArrayBuffer>;
public:
  ArrayBuffer() = delete;
  ArrayBuffer(const ArrayBuffer&) = default;
  ArrayBuffer(ArrayBuffer&&) = default;
  ArrayBuffer& operator=(const ArrayBuffer&) = default;
  ArrayBuffer& operator=(ArrayBuffer&&) = default;
  /**
   * Compares buffer handle identity, not byte contents. Copies and conversions
   * that recover the same native backing buffer share identity. Separate wrappers
   * around JS-managed storage do not.
   */
  bool operator==(const ArrayBuffer& other) const;
  ~ArrayBuffer() = default;

  /* implicit */ ArrayBuffer(JSArrayBuffer&& jsBuffer);
  /* implicit */ ArrayBuffer(NativeArrayBuffer&& nativeBuffer);

public:
  /** Returns the bytes. May be nullptr for empty buffers or invalidated JS buffers. */
  uint8_t* NULLABLE data() const [[clang::lifetimebound]];
  size_t size() const SWIFT_PRIVATE;
  /** Whether this buffer retains its storage lifetime independently of the JS Runtime. */
  bool isOwner() const SWIFT_PRIVATE;
  ArrayBuffer asOwning() const;

public:
  /**
   * Create a new `NativeArrayBuffer` that wraps the given data (without copy) of the given size.
   * The caller must keep the bytes valid until `deleteFunc` runs after the last shared wrapper is released.
   * The callback can delete the bytes directly or retain an owner whose release handles cleanup.
   * Use `ArrayBuffer::empty()` when there are no bytes to wrap.
   */
  static ArrayBuffer wrap(uint8_t* NON_NULL data, size_t size, DeleteFn&& deleteFunc);
  /**
   * Create a new `NativeArrayBuffer` that copies the given data of the given size
   * into a newly allocated buffer.
   * `data` may be nullptr only when `size` is zero.
   */
  static ArrayBuffer copy(const uint8_t* NULLABLE data, size_t size);
  /**
   * Create a new `NativeArrayBuffer` that copies the given `std::vector`.
   */
  static ArrayBuffer copy(const std::vector<uint8_t>& data);
  /**
   * Create a new `NativeArrayBuffer` that copies the given `ArrayBuffer`.
   */
  static ArrayBuffer copy(const ArrayBuffer& buffer);
  /**
   * Create a new `NativeArrayBuffer` that moves the given `std::vector`.
   */
  static ArrayBuffer move(std::vector<uint8_t>&& data);
  /**
   * Create a new `NativeArrayBuffer` that allocates a new buffer of the given size.
   */
  static ArrayBuffer allocate(size_t size);
  /**
   * Create an owning, zero-length buffer without allocating byte storage.
   */
  static ArrayBuffer empty();

private:
  std::variant<JSArrayBuffer, NativeArrayBuffer> _impl;
};

} // namespace margelo::nitro

#include <NitroModules/JSIConverter+ArrayBuffer.hpp>
