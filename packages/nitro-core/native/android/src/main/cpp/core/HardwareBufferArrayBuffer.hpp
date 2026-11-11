//
//  HardwareBufferArrayBuffer.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "ArrayBuffer.hpp"
#include "JHardwareBufferUtils.hpp"
#include <android/hardware_buffer.h>
#include <android/hardware_buffer_jni.h>
#include <fbjni/ByteBuffer.h>
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

#if __ANDROID_API__ >= 26
/**
 * Represents an `ArrayBuffer` that holds a `HardwareBuffer`.
 */
class HardwareBufferArrayBuffer final : public ArrayBuffer {
public:
  /**
   * Create a new `HardwareBufferArrayBuffer` instance that wraps the given `HardwareBuffer`.
   * This constructor will add a +1 retain count on the given `hardwareBuffer` using
   * `AHardwareBuffer_acquire(...)`, and release it again once it is destructured.
   */
  explicit HardwareBufferArrayBuffer(AHardwareBuffer* hardwareBuffer)
      : _hardwareBuffer(hardwareBuffer), _dataCached(nullptr), _isLocked(false) {
    if (!isHardwareBufferCPUReadable(hardwareBuffer)) [[unlikely]] {
      throw std::runtime_error("Cannot create HardwareBuffer-backed ArrayBuffer - the given HardwareBuffer does not allow CPU reads!");
    }

    AHardwareBuffer_acquire(hardwareBuffer);
  }

  ~HardwareBufferArrayBuffer() override {
    // Hermes GC can destroy JS objects on a non-JNI Thread.
    unlock();
    jni::ThreadScope::WithClassLoader([&] { AHardwareBuffer_release(_hardwareBuffer); });
  }

public:
  static bool isHardwareBufferCPUReadable(AHardwareBuffer* hardwareBuffer) {
    AHardwareBuffer_Desc description;
    AHardwareBuffer_describe(hardwareBuffer, &description);
    return (description.usage & AHARDWAREBUFFER_USAGE_CPU_READ_MASK) != 0;
  }

public:
  /**
   * Unlocks the HardwareBuffer if it was locked.
   * Subsequent calls to `data()` will have to lock the buffer again.
   *
   * It is a good practice to call this when the buffer is likely not being
   * read from using this `HardwareBufferArrayBuffer` instance again anytime soon.
   */
  void unlock() {
    if (_isLocked) {
      AHardwareBuffer_unlock(_hardwareBuffer, nullptr);
      _isLocked = false;
    }
    _dataCached = nullptr;
  }

public:
  [[nodiscard]] uint8_t* data() override {
    if (_isLocked && _dataCached != nullptr) {
      // We are still locked on the AHardwareBuffer* and have a valid buffer.
      return _dataCached;
    }
    void* buffer;
    int result = AHardwareBuffer_lock(_hardwareBuffer, AHARDWAREBUFFER_USAGE_CPU_READ_OFTEN, -1, nullptr, &buffer);
    if (result != 0) {
      throw std::runtime_error("Failed to read HardwareBuffer bytes!");
    }
    _dataCached = static_cast<uint8_t*>(buffer);
    _isLocked = true;
    return _dataCached;
  }
  [[nodiscard]] size_t size() const override {
    return JHardwareBufferUtils::getHardwareBufferSize(_hardwareBuffer);
  }
  [[nodiscard]] bool isOwner() const noexcept override {
    return true;
  }
  [[nodiscard]] size_t getExternalMemorySize() const override {
    return size();
  }

public:
  [[nodiscard]] AHardwareBuffer* getBuffer() const {
    return _hardwareBuffer;
  }

private:
  AHardwareBuffer* _hardwareBuffer;
  uint8_t* _dataCached;
  bool _isLocked;
};
#endif

} // namespace margelo::nitro
