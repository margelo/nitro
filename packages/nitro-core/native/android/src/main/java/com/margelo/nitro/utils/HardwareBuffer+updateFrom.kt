package com.margelo.nitro.utils

import android.hardware.HardwareBuffer
import android.os.Build
import androidx.annotation.RequiresApi

/**
 * Updates this [[HardwareBuffer]] with the data in the given [[hardwareBuffer]].
 * The given [[hardwareBuffer]] has to have the same description and shape as this [[HardwareBuffer]].
 */
@RequiresApi(Build.VERSION_CODES.O)
fun HardwareBuffer.updateFrom(hardwareBuffer: HardwareBuffer) {
  HardwareBufferUtils.copyHardwareBuffer(hardwareBuffer, this)
}
