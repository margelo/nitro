package com.margelo.nitro.utils

import android.hardware.HardwareBuffer
import android.os.Build
import androidx.annotation.Keep
import androidx.annotation.RequiresApi
import com.facebook.proguard.annotations.DoNotStrip

/**
 * HardwareBuffers are special types in JNI (`AHardwareBuffer*`)
 * and have to be boxed to `jobject*`.
 */
typealias BoxedHardwareBuffer = Any

@Suppress("KotlinJniMissingFunction")
@Keep
@DoNotStrip
class HardwareBufferUtils {
  companion object {
    @JvmStatic
    @RequiresApi(Build.VERSION_CODES.O)
    private external fun copyHardwareBuffer(sourceHardwareBuffer: BoxedHardwareBuffer): BoxedHardwareBuffer

    @JvmStatic
    @RequiresApi(Build.VERSION_CODES.O)
    private external fun copyHardwareBuffer(
      sourceHardwareBuffer: BoxedHardwareBuffer,
      destinationHardwareBuffer: BoxedHardwareBuffer,
    )

    /**
     * Copies the given [[hardwareBuffer]] into a new, identically shaped [[HardwareBuffer]].
     */
    @Throws
    @RequiresApi(Build.VERSION_CODES.O)
    fun copyHardwareBuffer(hardwareBuffer: HardwareBuffer): HardwareBuffer {
      val resultBoxed = copyHardwareBuffer(hardwareBuffer as Any)
      return resultBoxed as HardwareBuffer
    }

    /**
     * Copies the given [[source]] [[HardwareBuffer]] into the given [[destination]] [[HardwareBuffer]].
     */
    @Throws
    @RequiresApi(Build.VERSION_CODES.O)
    fun copyHardwareBuffer(
      source: HardwareBuffer,
      destination: HardwareBuffer,
    ) {
      copyHardwareBuffer(source as Any, destination as Any)
    }
  }
}
