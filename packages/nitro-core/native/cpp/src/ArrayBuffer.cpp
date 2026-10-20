//
//  ArrayBuffer.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#include <NitroModules/ArrayBuffer.hpp>
#include <NitroModules/BorrowingReference.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/Dispatcher.hpp>
#include <cassert>
#include <cstring>
#include <functional>
#include <jsi/jsi.h>
#include <thread>
#include <span>
#include <utility>

namespace margelo::nitro {

using namespace facebook;

class EmptyArrayBuffer final : public jsi::MutableBuffer {
public:
  uint8_t* data() override {
    return nullptr;
  }
  size_t size() const override {
    return 0;
  }
};

class OwningArrayBuffer final : public jsi::MutableBuffer {
public:
  OwningArrayBuffer(size_t size) {
    assert(size > 0 && "Use EmptyArrayBuffer for zero-length buffers.");
    _data = std::make_unique_for_overwrite<uint8_t[]>(size);
    _size = size;
  }
  OwningArrayBuffer(const OwningArrayBuffer&) = delete;
  OwningArrayBuffer(OwningArrayBuffer&&) = delete;
  ~OwningArrayBuffer() = default;
  
  uint8_t* data() override {
    return _data.get();
  }
  size_t size() const override {
    return _size;
  }
  
private:
  std::unique_ptr<uint8_t[]> _data;
  size_t _size;
};

class VectorArrayBuffer final : public jsi::MutableBuffer {
public:
  VectorArrayBuffer(std::vector<uint8_t>&& data): _data(std::move(data)) { }
  VectorArrayBuffer(const VectorArrayBuffer&) = delete;
  VectorArrayBuffer(VectorArrayBuffer&&) = delete;
  ~VectorArrayBuffer() = default;
  
  uint8_t* data() override {
    return _data.data();
  }
  size_t size() const override {
    return _data.size();
  }
  
private:
  std::vector<uint8_t> _data;
};

class WrappingArrayBuffer final : public jsi::MutableBuffer {
public:
  WrappingArrayBuffer(uint8_t* NON_NULL data, size_t size, DeleteFn&& deleteFn):
    _data(data), _size(size), _deleteFn(std::move(deleteFn)) { }
  WrappingArrayBuffer(const WrappingArrayBuffer&) = delete;
  WrappingArrayBuffer(WrappingArrayBuffer&&) = delete;
  ~WrappingArrayBuffer() {
    if (_deleteFn) {
      _deleteFn();
    }
  }
  
  uint8_t* data() override {
    return _data;
  }
  size_t size() const override {
    return _size;
  }
  
private:
  uint8_t* _data;
  size_t _size;
  DeleteFn _deleteFn;
};


// 1. ArrayBuffer

ArrayBuffer::ArrayBuffer(JSArrayBuffer&& jsBuffer) : _impl(std::move(jsBuffer)) {}

ArrayBuffer::ArrayBuffer(NativeArrayBuffer&& nativeBuffer) : _impl(std::move(nativeBuffer)) {}

ArrayBuffer ArrayBuffer::wrap(uint8_t* NON_NULL data, size_t size, DeleteFn&& deleteFunc) {
  auto nativeBuffer = std::make_shared<WrappingArrayBuffer>(data, size, std::move(deleteFunc));
  return ArrayBuffer(nativeBuffer);
}

ArrayBuffer ArrayBuffer::copy(const uint8_t* NULLABLE data, size_t size) {
  if (size == 0) {
    return ArrayBuffer::empty();
  }
  assert(data != nullptr && "Non-empty ArrayBuffers require a valid data pointer.");
  auto nativeBuffer = std::make_shared<OwningArrayBuffer>(size);
  std::memcpy(nativeBuffer->data(), data, size);
  return ArrayBuffer(nativeBuffer);
}

ArrayBuffer ArrayBuffer::copy(const std::vector<uint8_t>& data) {
  return ArrayBuffer::copy(data.data(), data.size());
}

ArrayBuffer ArrayBuffer::move(std::vector<uint8_t>&& data) {
  auto nativeBuffer = std::make_shared<VectorArrayBuffer>(std::move(data));
  return ArrayBuffer(nativeBuffer);
}

ArrayBuffer ArrayBuffer::copy(const ArrayBuffer& buffer) {
  return ArrayBuffer::copy(buffer.data(), buffer.size());
}

ArrayBuffer ArrayBuffer::allocate(size_t size) {
  if (size == 0) {
    return ArrayBuffer::empty();
  }
  auto nativeBuffer = std::make_shared<OwningArrayBuffer>(size);
  return ArrayBuffer(nativeBuffer);
}

ArrayBuffer ArrayBuffer::empty() {
  auto nativeBuffer = std::make_shared<EmptyArrayBuffer>();
  return ArrayBuffer(nativeBuffer);
}

uint8_t* NULLABLE ArrayBuffer::data() const {
  if (auto* jsArrayBuffer = std::get_if<JSArrayBuffer>(&_impl)) {
    return jsArrayBuffer->data();
  } else {
    const NativeArrayBuffer& nativeBuffer = std::get<NativeArrayBuffer>(_impl);
    return nativeBuffer->data();
  }
}

size_t ArrayBuffer::size() const {
  if (auto* jsArrayBuffer = std::get_if<JSArrayBuffer>(&_impl)) {
    return jsArrayBuffer->size();
  } else {
    const NativeArrayBuffer& nativeBuffer = std::get<NativeArrayBuffer>(_impl);
    return nativeBuffer->size();
  }
}

bool ArrayBuffer::operator==(const ArrayBuffer& other) const {
  return _impl == other._impl;
}

bool ArrayBuffer::isOwner() const {
  return std::holds_alternative<NativeArrayBuffer>(_impl);
}

ArrayBuffer ArrayBuffer::asOwning() const {
  if (auto* jsArrayBuffer = std::get_if<JSArrayBuffer>(&_impl)) {
    // It's a JS ArrayBuffer. We have to try to unwrap the `jsi::MutableBuffer`, or otherwise copy it.
    NativeArrayBuffer buffer = jsArrayBuffer->asOwning();
    return ArrayBuffer(std::move(buffer));
  } else {
    // Native buffers already retain their storage lifetime.
    return *this;
  }
}

// 2. JSArrayBuffer

JSArrayBuffer::JSArrayBuffer(jsi::Runtime& runtime, BorrowingReference<jsi::ArrayBuffer>&& jsReference)
    : _runtime(runtime), _jsReference(std::move(jsReference)) {
#ifdef NITRO_DEBUG
      _dispatcher = Dispatcher::getRuntimeGlobalDispatcher(runtime);
#endif
    }

bool JSArrayBuffer::operator==(const JSArrayBuffer& other) const {
  return &_runtime.get() == &other._runtime.get() && _jsReference == other._jsReference;
}

uint8_t* NULLABLE JSArrayBuffer::data() const {
#ifdef NITRO_DEBUG
  auto dispatcher = _dispatcher.lock();
  if (!dispatcher) {
    // Dispatcher (and its Runtime) has already been deleted! ArrayBuffer is no longer safe to access.
    return nullptr;
  }
  assert(dispatcher->isOnDispatcher() && "`data()` can only be accessed synchronously on the JS Thread! "
         "If you want to access it elsewhere, copy it first.");
#endif

  if (!_jsReference) [[unlikely]] {
    // JS Part has been deleted - data is now nullptr.
    return nullptr;
  }
  // JS Part is still alive - we can assume that the jsi::Runtime is safe to access here too.
  return _jsReference->data(_runtime);
}

size_t JSArrayBuffer::size() const {
#ifdef NITRO_DEBUG
  auto dispatcher = _dispatcher.lock();
  if (!dispatcher) {
    // Dispatcher (and its Runtime) has already been deleted! ArrayBuffer is no longer safe to access.
    return 0;
  }
  assert(dispatcher->isOnDispatcher() && "`size()` can only be accessed synchronously on the JS Thread! "
         "If you want to access it elsewhere, copy it first.");
#endif

  if (!_jsReference) [[unlikely]] {
    // JS Part has been deleted - size is now 0.
    return 0;
  }
  // JS Part is still alive - we can assume that the jsi::Runtime is safe to access here too.
  return _jsReference->size(_runtime);
}

NativeArrayBuffer JSArrayBuffer::asOwning() const {
#ifdef NITRO_DEBUG
  auto dispatcher = _dispatcher.lock();
  if (!dispatcher) {
    // Dispatcher (and its Runtime) has already been deleted! ArrayBuffer is no longer safe to access.
    throw std::runtime_error("Cannot escape JSArrayBuffer - the Dispatcher (and jsi::Runtime) have already been deleted!");
  }
  assert(dispatcher->isOnDispatcher() && "`asOwning()` can only be accessed synchronously on the JS Thread! "
         "If you want to access it elsewhere, copy it first.");
#endif
  if (!_jsReference) [[unlikely]] {
    // JS Part has been deleted - we cannot copy anything anymore.
    throw std::runtime_error("Cannot escape JSArrayBuffer - the jsi::Function has already been deleted!");
  }
  
  if (auto mutableBuffer = _jsReference->tryGetMutableBuffer(_runtime)) {
    // We can simply downcast
    return mutableBuffer;
  } else {
    // We have to copy
    size_t size = _jsReference->size(_runtime);
    if (size == 0) {
      return std::make_shared<EmptyArrayBuffer>();
    }
    uint8_t* data = _jsReference->data(_runtime);
    auto nativeBuffer = std::make_shared<OwningArrayBuffer>(size);
    std::memcpy(nativeBuffer->data(), data, size);
    return nativeBuffer;
  }
}

} // namespace margelo::nitro
