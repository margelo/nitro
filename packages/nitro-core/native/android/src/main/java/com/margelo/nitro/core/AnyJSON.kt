package com.margelo.nitro.core

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

/**
 * An encoded JSON value, stored without validation or re-encoding.
 *
 * Use a JSON encoder to produce [stringRepresentation]. The root can be an object,
 * array, string, number, boolean, or null. Equality compares the encoded text,
 * including whitespace and key order.
 *
 * With `kotlinx-serialization-json` in your module, `AnyJSON.encode(value)` and
 * `json.decode<T>()` convert from and to `@Serializable` types.
 */
@Keep
@DoNotStrip
data class AnyJSON(
  @field:Keep
  @field:DoNotStrip
  val stringRepresentation: String,
) {
  // Receiver for `AnyJSON.encode(...)`. The kotlinx helpers live in AnyJSON+Serialization.kt
  // so this @Keep class never references kotlinx, which is only a compileOnly dependency.
  companion object
}
