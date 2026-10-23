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

    Kotlin stores the encoded JSON as a `String`. Use `AnyJSON(stringRepresentation)` for existing JSON text, or `AnyJSON.encode(value)` for a `@Serializable` value. Decode it with `val value: MyType = json.decode()`. These use [kotlinx.serialization](https://github.com/Kotlin/kotlinx.serialization), so add `kotlinx-serialization-json` and the serialization plugin to your module.

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

## Use custom structs instead

Prefer [typed structs](custom-structs) when the fields are known. They provide compile-time checks, support every type (`bigint`, functions,
other Hybrid Objects, ...) and are faster because they avoid JSON serialization.
