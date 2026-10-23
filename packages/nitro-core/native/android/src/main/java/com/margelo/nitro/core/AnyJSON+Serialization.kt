@file:JvmName("AnyJSONSerialization")

package com.margelo.nitro.core

import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.json.Json

// kotlinx.serialization helpers for AnyJSON, the Kotlin counterparts of Swift's
// `AnyJSON(encoding:)` and `decode()`.
//
// Nitro compiles this file against kotlinx-serialization-json as a compileOnly dependency,
// so apps that don't call these functions don't ship kotlinx. Modules that call them add
// `org.jetbrains.kotlinx:kotlinx-serialization-json` and apply the
// `org.jetbrains.kotlin.plugin.serialization` Gradle plugin themselves.
//
// The reified functions call kotlinx's reified `encodeToString<T>()` and `decodeFromString<T>()`.
// The caller's serialization plugin then resolves `T.serializer()` at compile time. Calling
// `serializer<T>()` here would compile to a runtime lookup instead, because Nitro does not apply
// the plugin.

// The default configuration of the functions below. It differs from `Json.Default` to behave like
// Swift's JSONEncoder and JSONDecoder. @PublishedApi because public inline functions use it as a default.
@PublishedApi
internal val nitroJson: Json =
  Json {
    // JS objects often carry keys the native type doesn't declare. Swift's JSONDecoder ignores them too.
    ignoreUnknownKeys = true
    // Omit null properties when encoding, and decode a missing key as null for nullable properties
    // without a default value. This matches optional properties in TypeScript and Optionals in Swift.
    explicitNulls = false
    // Encode properties that equal their default value, like Swift's JSONEncoder.
    encodeDefaults = true
  }

/**
 * Encodes [value] to JSON with its `kotlinx.serialization` serializer.
 *
 * This is the Kotlin counterpart of Swift's `AnyJSON(encoding:)`:
 * ```kotlin
 * @Serializable
 * data class Status(val status: String)
 *
 * val json = AnyJSON.encode(Status("ok")) // {"status":"ok"}
 * ```
 * A `String` value is encoded as a JSON string. To wrap text that already is JSON,
 * use the `AnyJSON(stringRepresentation)` constructor instead.
 *
 * @param json The configuration to encode with. Defaults to Nitro's, which behaves like Swift's `JSONEncoder`.
 * @throws kotlinx.serialization.SerializationException if [value] cannot be encoded,
 *   for example because it contains `NaN` or `Infinity`.
 */
inline fun <reified T> AnyJSON.Companion.encode(
  value: T,
  json: Json = nitroJson,
): AnyJSON = AnyJSON(json.encodeToString<T>(value))

/**
 * Encodes [value] to JSON with the given [serializer].
 *
 * ```kotlin
 * val json = AnyJSON.encode(Status.serializer(), Status("ok"))
 * ```
 *
 * @param json The configuration to encode with. Defaults to Nitro's, which behaves like Swift's `JSONEncoder`.
 * @throws kotlinx.serialization.SerializationException if [value] cannot be encoded.
 */
fun <T> AnyJSON.Companion.encode(
  serializer: SerializationStrategy<T>,
  value: T,
  json: Json = nitroJson,
): AnyJSON = AnyJSON(json.encodeToString(serializer, value))

/**
 * Decodes this JSON to a [T] with its `kotlinx.serialization` serializer.
 *
 * This is the Kotlin counterpart of Swift's `decode()`:
 * ```kotlin
 * val status: Status = json.decode()
 * val tags = json.decode<List<String>>()
 * ```
 *
 * @param json The configuration to decode with. Defaults to Nitro's, which behaves like Swift's `JSONDecoder`.
 * @throws kotlinx.serialization.SerializationException if this JSON is invalid or doesn't match [T].
 * @throws IllegalArgumentException if the decoded value is not a valid [T].
 */
inline fun <reified T> AnyJSON.decode(json: Json = nitroJson): T = json.decodeFromString<T>(stringRepresentation)

/**
 * Decodes this JSON with the given [deserializer].
 *
 * ```kotlin
 * val status = json.decode(Status.serializer())
 * ```
 *
 * @param json The configuration to decode with. Defaults to Nitro's, which behaves like Swift's `JSONDecoder`.
 * @throws kotlinx.serialization.SerializationException if this JSON is invalid or doesn't match the [deserializer].
 * @throws IllegalArgumentException if the decoded value is not valid for the [deserializer].
 */
fun <T> AnyJSON.decode(
  deserializer: DeserializationStrategy<T>,
  json: Json = nitroJson,
): T = json.decodeFromString(deserializer, stringRepresentation)
