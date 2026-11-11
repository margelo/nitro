---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Primitives (`number`, `boolean`, `bigint`)

Primitive datatypes like `number`, `boolean` or `bigint` can use platform-native datatypes directly.
For example, a JS `number` is always a 64-bit `double` in C++, a `Double` in Swift, and a `Double` in Kotlin.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    interface Math extends HybridObject<{ … }> {
      add(a: number, b: number): number
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridMath: HybridMathSpec {
      func add(a: Double, b: Double) -> Double
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridMath: HybridMathSpec() {
      fun add(a: Double, b: Double): Double
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridMath : public HybridMathSpec {
      double add(double a, double b);
    }
    ```
  </TabItem>
</Tabs>

Primitives are very efficient and can be passed with little to no overhead, especially between C++ and Swift, and C++ and Kotlin.

## `bigint`

While a `bigint` is technically a primitive in JS, it is not fully representable by any standard library type in C++, Kotlin or Swift.

In Nitro, you can use `bigint` as either a signed, or unsigned 64-bit integer, which makes it a primitive, but limits its range to those within 64-bit signed/unsigned values.

### `Int64`

A 64-bit signed integer that ranges from -2^63 to 2^63-1.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    interface Math extends HybridObject<{ … }> {
      add(a: Int64, b: Int64): Int64
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridMath: HybridMathSpec {
      func add(a: Int64, b: Int64) -> Int64
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridMath: HybridMathSpec() {
      fun add(a: Long, b: Long): Long
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridMath : public HybridMathSpec {
      int64_t add(int64_t a, int64_t b);
    }
    ```
  </TabItem>
</Tabs>

### `UInt64`

A 64-bit unsigned integer that ranges from 0 to 2^64-1. On 64-bit systems, this is the most convenient type to describe pointer addresses.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    interface Math extends HybridObject<{ … }> {
      add(a: UInt64, b: UInt64): UInt64
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridMath: HybridMathSpec {
      func add(a: UInt64, b: UInt64) -> UInt64
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridMath: HybridMathSpec() {
      fun add(a: ULong, b: ULong): ULong
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridMath : public HybridMathSpec {
      uint64_t add(uint64_t a, uint64_t b);
    }
    ```
  </TabItem>
</Tabs>

:::warning
A `UInt64` cannot be stored in an [AnyMap](untyped-maps).
:::

### Anything larger

If you want to represent any `bigint` larger than `UInt64`/`Int64`'s maximum value, or smaller than `UInt64`/`Int64`'s minimum value, you must implement your own big integer type.

You can achieve this either by just passing the `bigint` as a [`string`](strings) and deserializing it again on the native side, or by rolling your own type via [Custom Types](custom-types) - in this case the `JSIConverter` can convert your custom big integer type from- and to a `bigint`.
