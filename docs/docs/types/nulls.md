---
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# Nulls (`null`)

A `null` is used to refer to the intentional absence of a value.

While it can be used as a separate type directly, `null` most commonly used to make an existing type _explicitly nullable_:

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    import { type HybridObject, Apple } from 'nitro-core'

    @Apple(...)
    export declare class Math extends HybridObject {
      a: number | null
    }
    ```

  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridMath: HybridMathSpec {
      var a: Variant_NullType_Double
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridMath: HybridMathSpec() {
      override var a: Variant_NullType_Double
    }
    ```

  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridMath: public HybridMathSpec {
      std::variant<NullType, double> getA() override;
      void setA(const std::variant<NullType, double>& value) override;
    };
    ```

  </TabItem>

</Tabs>

The `NullType` is a singleton structure in Nitro. To return `null` to JS:

<Tabs>
  <TabItem value="swift" label="Swift">
    ```swift
    func getNull() -> NullType {
      return .null
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    fun getNull(): NullType {
      return NullType.NULL
    }
    ```

  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    NullType getNull() {
      return nitro::null;
    }
    ```

  </TabItem>

</Tabs>

## Optionals vs `null`

In the same way that JavaScript distinguishes between an optional type/`undefined` and `null`, Nitro also has two separate concepts for the
two.

If you simply want to make an existing type _optional_, use [Optionals](optionals) instead.
