//
//  ArrayBuffer.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#include "ArrayBuffer.hpp"
#include "BorrowingReference.hpp"
#include "NitroDefines.hpp"
#include <functional>
#include <jsi/jsi.h>
#include <thread>

namespace margelo::nitro {

using namespace facebook;

// 1. ArrayBuffer

std::shared_ptr<ArrayBuffer> ArrayBuffer::wrap(uint8_t* NON_NULL data, size_t size, DeleteFn&& deleteFunc) {
  return std::make_shared<NativeArrayBuffer>(data, size, std::move(deleteFunc));
}

std::shared_ptr<ArrayBuffer> ArrayBuffer::copy(const uint8_t* NON_NULL data, size_t size) {
  uint8_t* copy = new uint8_t[size];
  std::memcpy(copy, data, size);
  return ArrayBuffer::wrap(copy, size, [=]() { delete[] copy; });
}

std::shared_ptr<ArrayBuffer> ArrayBuffer::copy(const std::vector<uint8_t>& data) {
  return ArrayBuffer::copy(data.data(), data.size());
}

std::shared_ptr<ArrayBuffer> ArrayBuffer::move(std::vector<uint8_t>&& data) {
  auto* vector = new std::vector<uint8_t>(std::move(data));
  return ArrayBuffer::wrap(vector->data(), vector->size(), [=]() { delete vector; });
}

std::shared_ptr<ArrayBuffer> ArrayBuffer::copy(const std::shared_ptr<ArrayBuffer>& buffer) {
  return ArrayBuffer::copy(buffer->data(), buffer->size());
}

std::shared_ptr<ArrayBuffer> ArrayBuffer::allocate(size_t size) {
  uint8_t* data = new uint8_t[size];
  return ArrayBuffer::wrap(data, size, [=]() { delete[] data; });
}

// 2. NativeArrayBuffer

NativeArrayBuffer::NativeArrayBuffer(uint8_t* NON_NULL data, size_t size, DeleteFn&& deleteFunc)
    : ArrayBuffer(), _data(data), _size(size), _deleteFunc(std::move(deleteFunc)) {}

NativeArrayBuffer::~NativeArrayBuffer() {
  if (_deleteFunc != nullptr) {
    _deleteFunc();
  }
}

uint8_t* NON_NULL NativeArrayBuffer::data() {
  return _data;
}

size_t NativeArrayBuffer::size() const {
  return _size;
}

bool NativeArrayBuffer::isOwner() const noexcept {
  return _deleteFunc != nullptr;
}

size_t NativeArrayBuffer::getExternalMemorySize() const {
  return isOwner() ? _size : 0;
}

// 3. JSArrayBuffer

JSArrayBuffer::JSArrayBuffer(jsi::Runtime& runtime, BorrowingReference<jsi::ArrayBuffer> jsReference)
    : ArrayBuffer(), _runtime(runtime), _jsReference(jsReference), _initialThreadId(std::this_thread::get_id()) {}

JSArrayBuffer::~JSArrayBuffer() {}

uint8_t* NULLABLE JSArrayBuffer::data() {
  if (_initialThreadId != std::this_thread::get_id()) [[unlikely]] {
    throw std::runtime_error("`data()` can only be accessed synchronously on the JS Thread! "
                             "If you want to access it elsewhere, copy it first.");
  }

  if (!_jsReference) [[unlikely]] {
    // JS Part has been deleted - data is now nullptr.
    return nullptr;
  }
  // JS Part is still alive - we can assume that the jsi::Runtime is safe to access here too.
  return _jsReference->data(_runtime);
}

size_t JSArrayBuffer::size() const {
  if (_initialThreadId != std::this_thread::get_id()) [[unlikely]] {
    throw std::runtime_error("`size()` can only be accessed synchronously on the JS Thread! "
                             "If you want to access it elsewhere, copy it first.");
  }

  if (!_jsReference) [[unlikely]] {
    // JS Part has been deleted - size is now 0.
    return 0;
  }
  // JS Part is still alive - we can assume that the jsi::Runtime is safe to access here too.
  return _jsReference->size(_runtime);
}

bool JSArrayBuffer::isOwner() const noexcept {
  return false;
}

} // namespace margelo::nitro
