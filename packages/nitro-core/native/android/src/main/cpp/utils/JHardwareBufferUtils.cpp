//
//  JHardwareBufferUtils.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 11.07.25.
//

#include "JHardwareBufferUtils.hpp"
#include "NitroDefines.hpp"
#include <android/hardware_buffer_jni.h>
#include <android/ndk-version.h>

namespace margelo::nitro {

size_t getHardwareBufferBytesPerPixel(size_t hardwareBufferFormat) {
  switch (hardwareBufferFormat) {
    case AHARDWAREBUFFER_FORMAT_R8_UNORM:
    case AHARDWAREBUFFER_FORMAT_S8_UINT:
      return 1;

    case AHARDWAREBUFFER_FORMAT_R5G6B5_UNORM:
    case AHARDWAREBUFFER_FORMAT_R16_UINT:
    case AHARDWAREBUFFER_FORMAT_D16_UNORM:
      return 2;

    case AHARDWAREBUFFER_FORMAT_R8G8B8_UNORM:
      return 3;

    case AHARDWAREBUFFER_FORMAT_R8G8B8A8_UNORM:
    case AHARDWAREBUFFER_FORMAT_R8G8B8X8_UNORM:
    case AHARDWAREBUFFER_FORMAT_R10G10B10A2_UNORM:
    case AHARDWAREBUFFER_FORMAT_R16G16_UINT:
    case AHARDWAREBUFFER_FORMAT_D24_UNORM:
    case AHARDWAREBUFFER_FORMAT_D24_UNORM_S8_UINT:
    case AHARDWAREBUFFER_FORMAT_D32_FLOAT:
      return 4;

    case AHARDWAREBUFFER_FORMAT_R16G16B16A16_FLOAT:
    case AHARDWAREBUFFER_FORMAT_R10G10B10A10_UNORM:
    // D32_FLOAT_S8_UINT is 32-bit depth + 8-bit stencil, padded to 64 bits (GL_DEPTH32F_STENCIL8)
    case AHARDWAREBUFFER_FORMAT_D32_FLOAT_S8_UINT:
      return 8;

    case AHARDWAREBUFFER_FORMAT_Y8Cb8Cr8_420:
    case AHARDWAREBUFFER_FORMAT_YCbCr_P010:
#if defined(__NDK_MAJOR__) && __NDK_MAJOR__ >= 28
    case AHARDWAREBUFFER_FORMAT_YCbCr_P210:
#endif
      throw std::runtime_error("Cannot get bytes per pixel: YUV-HardwareBuffers are multi-planar "
                               "and don't have a single bytes-per-pixel value!");
    case AHARDWAREBUFFER_FORMAT_BLOB:
      throw std::runtime_error("Cannot get bytes per pixel: Blob-HardwareBuffers don't have pixels!");
    default:
      throw std::runtime_error("Cannot get bytes per pixel: Unknown HardwareBuffer format!");
  }
}

size_t JHardwareBufferUtils::getHardwareBufferSize([[maybe_unused]] AHardwareBuffer* hardwareBuffer) {
#if __ANDROID_API__ >= 26
  AHardwareBuffer_Desc description;
  AHardwareBuffer_describe(hardwareBuffer, &description);

  switch (description.format) {
    case AHARDWAREBUFFER_FORMAT_BLOB:
      // Blob HardwareBuffers hold bytes flat:
      return description.width;
    default:
      size_t bytesPerPixel = getHardwareBufferBytesPerPixel(description.format);
      return static_cast<size_t>(description.height) * static_cast<size_t>(description.stride) * static_cast<size_t>(description.layers) *
             bytesPerPixel;
  }
#else
  throw std::runtime_error("ArrayBuffer(HardwareBuffer) requires NDK API 26 or above! (minSdk >= 26)");
#endif
}

jni::local_ref<jni::JObject>
JHardwareBufferUtils::copyHardwareBufferBoxedNew(jni::alias_ref<jni::JClass>,
                                                 [[maybe_unused]] jni::alias_ref<jni::JObject> boxedHardwareBuffer) {
#if __ANDROID_API__ >= 26
  // 1. Unbox HardwareBuffer from jobject
  AHardwareBuffer* sourceHardwareBuffer = AHardwareBuffer_fromHardwareBuffer(jni::Environment::current(), boxedHardwareBuffer.get());
  // 2. Describe the buffer
  AHardwareBuffer_Desc description;
  AHardwareBuffer_describe(sourceHardwareBuffer, &description);
  // 3. Create a new buffer from the same description
  AHardwareBuffer* destinationHardwareBuffer;
  AHardwareBuffer_allocate(&description, &destinationHardwareBuffer);
  // 4. Copy the data over
  copyHardwareBuffer(sourceHardwareBuffer, destinationHardwareBuffer);
  // 5. Box it into jobject again
  jobject boxed = AHardwareBuffer_toHardwareBuffer(jni::Environment::current(), destinationHardwareBuffer);
  return jni::make_local(boxed);
#else
  throw std::runtime_error("ArrayBuffer(HardwareBuffer) requires NDK API 26 or above! (minSdk >= 26)");
#endif
}

void JHardwareBufferUtils::copyHardwareBufferBoxed(jni::alias_ref<jni::JClass>,
                                                   [[maybe_unused]] jni::alias_ref<jni::JObject> boxedSourceHardwareBuffer,
                                                   [[maybe_unused]] jni::alias_ref<jni::JObject> boxedDestinationHardwareBuffer) {
#if __ANDROID_API__ >= 26
  // 1. Unbox HardwareBuffer from jobject
  AHardwareBuffer* sourceHardwareBuffer = AHardwareBuffer_fromHardwareBuffer(jni::Environment::current(), boxedSourceHardwareBuffer.get());
  AHardwareBuffer* destinationHardwareBuffer =
      AHardwareBuffer_fromHardwareBuffer(jni::Environment::current(), boxedDestinationHardwareBuffer.get());
  // 2. Copy data over from source -> destination
  copyHardwareBuffer(sourceHardwareBuffer, destinationHardwareBuffer);
#else
  throw std::runtime_error("ArrayBuffer(HardwareBuffer) requires NDK API 26 or above! (minSdk >= 26)");
#endif
}

void JHardwareBufferUtils::copyHardwareBuffer([[maybe_unused]] AHardwareBuffer* sourceHardwareBuffer,
                                              [[maybe_unused]] AHardwareBuffer* destinationHardwareBuffer) {
#if __ANDROID_API__ >= 26
  // 1. Get info about source buffer
  size_t sourceSize = getHardwareBufferSize(sourceHardwareBuffer);

  // 2. Get info about the destination buffer
#ifdef NITRO_DEBUG
  size_t destinationSize = getHardwareBufferSize(destinationHardwareBuffer);
  if (sourceSize != destinationSize) {
    throw std::runtime_error("Source HardwareBuffer (" + std::to_string(sourceSize) + " bytes) and destination HardwareBuffer (" +
                             std::to_string(destinationSize) + " bytes) are not the same size!");
  }
#endif

  // 3. Copy data over
  void* sourceData;
  void* destinationData;
  int lockSource = AHardwareBuffer_lock(sourceHardwareBuffer, AHARDWAREBUFFER_USAGE_CPU_READ_OFTEN, -1, nullptr, &sourceData);
  if (lockSource != 0) {
    throw std::runtime_error("Failed to lock source HardwareBuffer! Error: " + std::to_string(lockSource));
  }
  int lockDestination =
      AHardwareBuffer_lock(destinationHardwareBuffer, AHARDWAREBUFFER_USAGE_CPU_WRITE_OFTEN, -1, nullptr, &destinationData);
  if (lockDestination != 0) {
    AHardwareBuffer_unlock(sourceHardwareBuffer, nullptr);
    throw std::runtime_error("Failed to lock destination HardwareBuffer! Error: " + std::to_string(lockDestination));
  }
  memcpy(destinationData, sourceData, sourceSize);
  AHardwareBuffer_unlock(sourceHardwareBuffer, nullptr);
  AHardwareBuffer_unlock(destinationHardwareBuffer, nullptr);
#else
  throw std::runtime_error("ArrayBuffer(HardwareBuffer) requires NDK API 26 or above! (minSdk >= 26)");
#endif
}

} // namespace margelo::nitro
