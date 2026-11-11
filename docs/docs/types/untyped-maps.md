---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Untyped maps (`AnyMap` / `object`)

An untyped map represents a JSON-like structure with a value that can either be a `number`, a `string`, a `boolean`, an `Int64`, a `null`, an array or an object.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    interface Fetch extends HybridObject<{ … }> {
      get(url: string): AnyMap
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridFetch: HybridFetchSpec {
      func get(url: String) -> AnyMap
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridFetch: HybridFetchSpec() {
      fun get(url: String): AnyMap
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridFetch: public HybridFetchSpec {
      std::shared_ptr<AnyMap> get(const std::string& url);
    }
    ```
  </TabItem>
</Tabs>

:::tip
While untyped maps are implemented efficiently, Nitro cannot sufficiently optimize the object as keys and value-types are not known in advance.
If possible, **avoid untyped maps** and use [strongly typed objects](custom-structs) instead.
:::
