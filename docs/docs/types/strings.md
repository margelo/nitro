---
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# Strings (`string`)

A `string` handles like a [primitive](primitives), but technically isn't one. In C++, a `string` is represented using a UTF-8 `std::string`.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    import { type HybridObject, Apple } from 'nitro-core'

    @Apple(...)
    export declare class MyHybrid extends HybridObject {
      concat(a: string, b: string): string
    }
    ```

  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class MyHybrid: HybridMyHybridSpec {
      func concat(a: String, b: String) throws -> String
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class MyHybrid: HybridMyHybridSpec() {
      override fun concat(a: String, b: String): String
    }
    ```

  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class MyHybrid: public HybridMyHybridSpec {
      std::string concat(const std::string& a, const std::string& b) override;
    };
    ```

  </TabItem>

</Tabs>
