---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Optionals (`T?`)

Optional or undefined values can be declared with the question mark operator (`?`) or with an `undefined` variant.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    interface Math extends HybridObject<{ … }> {
      a?: number
      b: number | undefined
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridMath: HybridMathSpec {
      var a: Double?
      var b: Double?
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridMath: HybridMathSpec() {
      override var a: Double?
      override var b: Double?
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridMath: public HybridMathSpec {
      std::optional<double> a;
      std::optional<double> b;
    };
    ```
  </TabItem>
</Tabs>

In Kotlin/Java, nullables have to be boxed in object types.

## Optionals vs `null`

In the same way that JavaScript distinguishes between an optional type/`undefined` and `null`, Nitro also has two separate concepts for the two.

An optional type (or `undefined`) represents a non-declared value, whereas `null` represents an explicit absence of a value. See [Nulls](nulls) for more information.
