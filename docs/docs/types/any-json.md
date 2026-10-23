---
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# JSON values (`AnyJSON`)

`AnyJSON` represents a JSON value: a string, number, boolean, `null`, array, or object. Arrays and objects can contain nested JSON values.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    import { type AnyJSON, type HybridObject, iOS } from 'nitro-core'

    @iOS(...)
    export declare class Fetch extends HybridObject {
      get(url: string): AnyJSON
    }
    ```

  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    import NitroModules

    func get(url: String) throws -> AnyJSON {
      return try AnyJSON(encoding: ["status": "ok"])
    }
    ```

    Swift stores the encoded JSON as `Data`. Use `AnyJSON(data:)` for existing UTF-8 JSON, or `AnyJSON(encoding:)` for an `Encodable` value. Decode it with `let value: MyDecodableType = try json.decode()`.

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    import com.margelo.nitro.core.AnyJSON
    import com.margelo.nitro.core.encode

    override fun get(url: String): AnyJSON {
      return AnyJSON.encode(mapOf("status" to "ok"))
    }
    ```

    Kotlin stores the encoded JSON as a `String`. Use `AnyJSON(stringRepresentation)` for existing JSON text, or `AnyJSON.encode(value)` for
    a value that [kotlinx.serialization](https://github.com/Kotlin/kotlinx.serialization) can encode. Decode it with
    `val value: MyType = json.decode()`. Both functions need `kotlinx-serialization-json` in your module, see [Kotlin setup](#kotlin-setup).
    For maps with mixed value types, build a `JsonObject` with `buildJsonObject { ... }` instead of `mapOf(...)`.

  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    #include <NitroModules/AnyJSON.hpp>

    AnyJSON get(const std::string& url) {
      return AnyJSON{R"({"status":"ok"})"};
    }
    ```

    C++ stores UTF-8 JSON in `AnyJSON::stringRepresentation`. Return it by value and use your preferred JSON library to encode or decode its contents.

  </TabItem>

</Tabs>

When JS values or objects are passed to native, `AnyJSON` serializes them via `JSON.stringify(...)`. You can decode JSON using platform
decoders, or separate JSON libraries.

When `AnyJSON` values are returned to JS, they are parsed via `JSON.parse(...)` to construct JS values or objects.

## Kotlin setup

`AnyJSON.encode(...)` and `json.decode()` use [kotlinx.serialization](https://github.com/Kotlin/kotlinx.serialization). Nitro compiles
against it without adding it to your app. Add it to the module that calls these functions, and apply the serialization plugin for your
`@Serializable` types:

```groovy
buildscript {
  dependencies {
    // Use the same version as your Kotlin Gradle plugin
    classpath "org.jetbrains.kotlin:kotlin-serialization:2.2.10"
  }
}

apply plugin: "org.jetbrains.kotlin.plugin.serialization"

dependencies {
  implementation "org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1"
}
```

```kotlin
import com.margelo.nitro.core.AnyJSON
import com.margelo.nitro.core.decode
import com.margelo.nitro.core.encode
import kotlinx.serialization.Serializable

@Serializable
data class User(val name: String, val email: String? = null)

override fun greet(json: AnyJSON): AnyJSON {
  val user: User = json.decode()
  return AnyJSON.encode(user.copy(name = "Hello ${user.name}"))
}
```

The defaults match Swift's `JSONDecoder` and `JSONEncoder`: unknown keys are ignored, a missing key decodes to `null` for nullable
properties without a default value, `null` properties are left out when encoding, and properties are encoded even if they equal their
default value. To change this, pass your own `Json`. Keep it in a top-level `val`, because creating one per call is slow:

```kotlin
import com.margelo.nitro.core.defaultJson
import kotlinx.serialization.json.Json

private val lenientJson = Json(AnyJSON.defaultJson) { isLenient = true }

val user = json.decode<User>(lenientJson)
```

If `kotlinx-serialization-json` is missing, `encode` and `decode` throw a `NoClassDefFoundError` at runtime. If the serialization plugin is
missing, decoding a `@Serializable` class throws `Serializer for class 'User' is not found`.

For untyped access without any dependency, Android's `org.json` works too, for example `JSONObject(json.stringRepresentation)`.

## Use custom structs instead

Prefer [typed structs](custom-structs) when the fields are known. They provide compile-time checks, support every type (`bigint`, functions,
other Hybrid Objects, ...) and are faster because they avoid JSON serialization.
