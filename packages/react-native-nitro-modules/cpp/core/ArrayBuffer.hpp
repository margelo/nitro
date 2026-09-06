//
//  ArrayBuffer.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "BorrowingReference.hpp"
#include "NitroDefines.hpp"
#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <thread>
#include <vector>

namespace margelo::nitro {

using namespace facebook;

using DeleteFn = std::function<void()>;

/**
 * Represents a raw byte buffer that can be read from-, and
 * written to- from both JavaScript and C++.
 * `ArrayBuffer` is not thread-safe and does not lock multi-thread access.
 *
 * `ArrayBuffer` can either be a `JSArrayBuffer`, or a `NativeArrayBuffer`.
 * - `NativeArrayBuffer`: Created from native (C++), and can either own the memory (`isOwner()`), or borrow it.
 * - `JSArrayBuffer`: Received from JS, and will only be alive for as long as the JS Runtime is actually alive.
 *
 * Also, an `ArrayBuffer` can either own its memory, or just borrow its memory.
 * - Owning = the `ArrayBuffer`'s `data()` is alive as long as the `ArrayBuffer` is alive.
 *   When this `ArrayBuffer` gets deleted, it will free the memory.
 * - Borrowed = the `ArrayBuffer`'s `data()` might be deleted at any point from an external source (e.g. the JS garbage collector).
 *   When this `ArrayBuffer` gets deleted, the memory will not be freed explicitly, as someone else owns it.
 */
class ArrayBuffer : public jsi::MutableBuffer {
public:
  ArrayBuffer() = default;
  ArrayBuffer(const ArrayBuffer&) = delete;
  ArrayBuffer(ArrayBuffer&&) = delete;
  virtual ~ArrayBuffer() = default;

public:
  /**
   * Returns whether this `ArrayBuffer` is actually owning the data,
   * or if it is just borrowed from an external source (either a native
   * memory that we didn't allocate, or from JS - which can be deleted at any point).
   */
  virtual bool isOwner() const noexcept = 0;
  /**
   * Gets the size of any external memory retained by this `ArrayBuffer`, in bytes.
   * This is reported to the JS VM when the buffer is converted to a `jsi::ArrayBuffer`
   * so it can account for memory that is not allocated by the VM itself.
   *
   * JS-backed and borrowed buffers return `0` because their memory is either already
   * tracked by the JS VM or is not retained by this `ArrayBuffer`.
   */
  virtual size_t getExternalMemorySize() const {
    return 0;
  }

public:
  /**
   * Create a new `NativeArrayBuffer` that wraps the given data (without copy) of the given size,
   * and calls `deleteFunc` in which `data` should be deleted.
   */
  static std::shared_ptr<ArrayBuffer> wrap(uint8_t* NON_NULL data, size_t size, DeleteFn&& deleteFunc);
  /**
   * Create a new `NativeArrayBuffer` that copies the given data of the given size
   * into a newly allocated buffer.
   */
  static std::shared_ptr<ArrayBuffer> copy(const uint8_t* NON_NULL data, size_t size);
  /**
   * Create a new `NativeArrayBuffer` that copies the given `std::vector`.
   */
  static std::shared_ptr<ArrayBuffer> copy(const std::vector<uint8_t>& data);
  /**
   * Create a new `NativeArrayBuffer` that moves the given `std::vector`.
   */
  static std::shared_ptr<ArrayBuffer> move(std::vector<uint8_t>&& data);
  /**
   * Create a new `NativeArrayBuffer` that copies the given `std::shared_ptr<ArrayBuffer>`.
   */
  static std::shared_ptr<ArrayBuffer> copy(const std::shared_ptr<ArrayBuffer>& buffer);
  /**
   * Create a new `NativeArrayBuffer` that allocates a new buffer of the given size.
   */
  static std::shared_ptr<ArrayBuffer> allocate(size_t size);
};

/**
 * Represents an `ArrayBuffer` that is allocated on the native (C++) side.
 * It can either be "owning" or "borrowing".
 *
 * - Owning = the `ArrayBuffer`'s `data()` is alive as long as the `ArrayBuffer` is alive.
 *   When this `ArrayBuffer` gets deleted, it will free the memory.
 * - Borrowed = the `ArrayBuffer`'s `data()` might be deleted at any point from an external source (e.g. the JS garbage collector).
 *   When this `ArrayBuffer` gets deleted, the memory will not be freed explicitly, as someone else owns it.
 *
 * It is safe to access `data()` and `size()` from any Thread, but there are no synchronization/mutexes implemented by default.
 */
class NativeArrayBuffer final : public ArrayBuffer {
public:
  /**
   * Create a new **owning** `ArrayBuffer`.
   * The `ArrayBuffer` can be kept in memory, as C++ owns the data
   * and will only delete it once this `ArrayBuffer` gets deleted.
   *
   * Once this `ArrayBuffer` goes out of scope, `deleteFunc` will be called.
   * The caller is responsible for deleting the memory (`data`) here.
   */
  NativeArrayBuffer(uint8_t* NON_NULL data, size_t size, DeleteFn&& deleteFunc);
  ~NativeArrayBuffer();

public:
  uint8_t* NON_NULL data() override;
  size_t size() const override;
  bool isOwner() const noexcept override;
  size_t getExternalMemorySize() const override;

private:
  uint8_t* NON_NULL _data;
  size_t _size;
  DeleteFn _deleteFunc;
};

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
class JSArrayBuffer final : public ArrayBuffer {
public:
  explicit JSArrayBuffer(jsi::Runtime& runtime, BorrowingReference<jsi::ArrayBuffer> jsReference);
  ~JSArrayBuffer();

public:
  /**
   * Gets the data this `ArrayBuffer` points to, or `nullptr` if it has already been deleted.
   */
  uint8_t* NULLABLE data() override;
  /**
   * Gets the size of the data this `ArrayBuffer` points to, or `0` if it has already been deleted.
   */
  size_t size() const override;
  /**
   * Returns `false` for JS-based ArrayBuffers.
   */
  bool isOwner() const noexcept override;

public:
  BorrowingReference<jsi::ArrayBuffer> getJSReference() const noexcept {
    return _jsReference;
  }

private:
  jsi::Runtime& _runtime;
  BorrowingReference<jsi::ArrayBuffer> _jsReference;
  std::thread::id _initialThreadId;
};

} // namespace margelo::nitro
