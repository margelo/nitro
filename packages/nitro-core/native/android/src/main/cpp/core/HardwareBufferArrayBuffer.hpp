//
//  HardwareBufferArrayBuffer.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "JHardwareBufferUtils.hpp"
#include "JRunnable.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <android/hardware_buffer.h>
#include <android/hardware_buffer_jni.h>
#include <fbjni/ByteBuffer.h>
#include <fbjni/fbjni.h>

namespace margelo::nitro {

namespace jni = facebook::jni;
namespace jsi = facebook::jsi;

#if __ANDROID_API__ >= 26
/**
 * Represents an `ArrayBuffer` that holds a `HardwareBuffer`.
 */
class HardwareBufferArrayBuffer final : public jsi::MutableBuffer {
public:
  /**
   * Create a new `HardwareBufferArrayBuffer` instance that wraps the given `HardwareBuffer`.
   * This constructor will add a +1 retain count on the given `hardwareBuffer` using
   * `AHardwareBuffer_acquire(...)`, and release it again once it is destructured.
   * If an `onDelete` `Runnable` is given, it runs after that release.
   */
  HardwareBufferArrayBuffer(AHardwareBuffer* hardwareBuffer, const jni::alias_ref<JRunnable>& onDelete)
      : _hardwareBuffer(hardwareBuffer), _dataCached(nullptr), _isLocked(false) {
    if (!isHardwareBufferCPUReadable(hardwareBuffer)) [[unlikely]] {
      throw std::runtime_error("Cannot create HardwareBuffer-backed ArrayBuffer - the given HardwareBuffer does not allow CPU reads!");
    }

    AHardwareBuffer_acquire(hardwareBuffer);
    _onDelete = jni::make_global(onDelete);
  }

  ~HardwareBufferArrayBuffer() override {
    unlock();
    AHardwareBuffer_release(_hardwareBuffer);
    runAndResetGlobalRef(_onDelete);
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

public:
  [[nodiscard]] AHardwareBuffer* getBuffer() const {
    return _hardwareBuffer;
  }

private:
  AHardwareBuffer* _hardwareBuffer;
  uint8_t* _dataCached;
  bool _isLocked;
  jni::global_ref<JRunnable> _onDelete;
};
#endif

} // namespace margelo::nitro
