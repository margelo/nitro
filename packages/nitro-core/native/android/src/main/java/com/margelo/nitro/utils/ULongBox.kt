package com.margelo.nitro.utils

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import java.lang.reflect.Field
import java.lang.reflect.Modifier

/**
 * Gives JNI the classes of Kotlin's `ULong` and `ULongArray` boxes and the fields that hold their
 * values, so JNI can create and read the boxes, e.g. as `Map` values, without calling into Kotlin.
 * R8 can rename these classes and fields, so JNI never names them and the fields are found by type.
 */
@OptIn(ExperimentalUnsignedTypes::class)
@Keep
@DoNotStrip
internal object ULongBox {
  @JvmStatic
  @Keep
  @DoNotStrip
  fun ulongClass(): Class<*> = ULong::class.java

  @JvmStatic
  @Keep
  @DoNotStrip
  fun ulongField(): Any = getValueField(ULong::class.java, Long::class.java)

  @JvmStatic
  @Keep
  @DoNotStrip
  fun ulongArrayClass(): Class<*> = ULongArray::class.java

  @JvmStatic
  @Keep
  @DoNotStrip
  fun ulongArrayField(): Any = getValueField(ULongArray::class.java, LongArray::class.java)

  // JNI does not call these. They write and read the value fields, so R8 keeps the fields and
  // does not assume that they always hold their default value.
  @JvmStatic
  @Keep
  fun box(value: Long): Any = value.toULong()

  @JvmStatic
  @Keep
  fun unbox(value: Any): Long = (value as ULong).toLong()

  @JvmStatic
  @Keep
  fun boxArray(values: LongArray): Any = values.asULongArray()

  @JvmStatic
  @Keep
  fun unboxArray(value: Any): LongArray = (value as ULongArray).asLongArray()

  private fun getValueField(
    clazz: Class<*>,
    type: Class<*>,
  ): Field = clazz.declaredFields.single { field -> field.type == type && !Modifier.isStatic(field.modifiers) }
}
