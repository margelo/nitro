---
title: Nitro Typing System
description: Understand Nitro's static, type-safe, and null-safe conversion system for JavaScript, C++, Swift, and Kotlin native module types.
---

# Nitro's Typing System

Nitro uses an extensible typing system to efficiently convert between JS and C++ types - **statically defined** and fully **type-safe** and **null-safe at compile-time**.

For example, a JS `number` will always be a `double` on the native side:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Math.nitro.ts"
import { type HybridObject, iOS } from 'nitro-core'

@iOS(...)
export declare class Math extends HybridObject {
  add(a: number, b: number): number
}
```

</div>
<div className="side-by-side-block">

```cpp title="HybridMath.hpp"
class HybridMath : public HybridMathSpec {
public:
  double add(double a, double b) override;
};
```

</div>
</div>

Nitro strictly enforces **type-safety** and **null-safety** - both at compile-time and at runtime.
This prevents accidentally passing a wrong type to `add(..)` (for example, a `string`) and performs null-checks to prevent passing and returning `null`/`undefined` values.

On the JS side (TypeScript), type- and null-safety is enforced via TypeScript - so use it!

## Nitrogen

[Nitrogen](../concepts/nitrogen) ensures that TypeScript definitions are always in sync with native type definitions.
You can also use Nitro without nitrogen, in this case TypeScript definitions have to be written manually.

## Supported Types

These are all the types Nitro supports out of the box:

<table>
  <tr>
    <th>JS Type</th>
    <th>C++ Type</th>
    <th>Swift Type</th>
    <th>Kotlin Type</th>
  </tr>

  <tr>
    <td><code>number</code></td>
    <td><code>double</code> / <code>int</code> / <code>float</code></td>
    <td><code>Double</code></td>
    <td><code>Double</code></td>
  </tr>
  <tr>
    <td><code>boolean</code></td>
    <td><code>bool</code></td>
    <td><code>Bool</code></td>
    <td><code>Boolean</code></td>
  </tr>
  <tr>
    <td><code>string</code></td>
    <td><code>std::string</code></td>
    <td><code>String</code></td>
    <td><code>String</code></td>
  </tr>
  <tr>
    <td><code>Int64</code> (<code>bigint</code>)</td>
    <td><code>int64_t</code></td>
    <td><code>Int64</code></td>
    <td><code>Long</code></td>
  </tr>
  <tr>
    <td><code>UInt64</code> (<code>bigint</code>)</td>
    <td><code>uint64_t</code></td>
    <td><code>UInt64</code></td>
    <td><code>ULong</code></td>
  </tr>
  <tr>
    <td><code>T[]</code></td>
    <td><code>std::vector&lt;T&gt;</code></td>
    <td><code>[T]</code></td>
    <td><code>Array&lt;T&gt;</code> / <code>PrimitiveArray</code></td>
  </tr>
  <tr>
    <td><code>T?</code></td>
    <td><code>std::optional&lt;T&gt;</code></td>
    <td><code>T?</code></td>
    <td><code>T?</code></td>
  </tr>
  <tr>
    <td><code>null</code></td>
    <td><code>NullType</code></td>
    <td><code>NullType</code></td>
    <td><code>NullType</code></td>
  </tr>
  <tr>
    <td><code>[A, B, ...]</code></td>
    <td><code>std::tuple&lt;A, B, ...&gt;</code></td>
    <td><code>(A, B)</code> 🟡  (<a href="https://github.com/margelo/nitro/issues/38">#38</a>)</td>
    <td>❌</td>
  </tr>
  <tr>
    <td><code>A | B | ...</code></td>
    <td><code>std::variant&lt;A, B, ...&gt;</code></td>
    <td><code>Variant_A_B_C</code></td>
    <td><code>Variant_A_B_C</code></td>
  </tr>
  <tr>
    <td><code>(T...) =&gt; void</code></td>
    <td><code>std::function&lt;void (T...)&gt;</code></td>
    <td><code>@escaping (T...) -&gt; Void</code></td>
    <td><code>(T...) -&gt; Unit</code></td>
  </tr>
  <tr>
    <td><code>(T...) =&gt; R</code></td>
    <td><code>std::function&lt;std::shared_ptr&lt;Promise&lt;R&gt;&gt; (T...)&gt;</code></td>
    <td><code>@escaping (T...) -&gt; <a href="https://github.com/margelo/nitro/tree/main/packages/nitro-core/native/apple/core/Promise.swift">Promise&lt;R&gt;</a></code></td>
    <td><code>(T...) -&gt; <a href="https://github.com/margelo/nitro/tree/main/packages/nitro-core/native/android/src/main/java/com/margelo/nitro/core/Promise.kt">Promise&lt;R&gt;</a></code></td>
  </tr>
  <tr>
    <td><code>Sync&lt;(T...) =&gt; R&gt;</code></td>
    <td><code>std::function&lt;R (T...)&gt;</code></td>
    <td><code>@escaping (T...) -&gt; R</code></td>
    <td><code>(T...) -&gt; R</code></td>
  </tr>
  <tr>
    <td><code>Record&lt;string, T&gt;</code></td>
    <td><code>std::unordered_map&lt;std::string, T&gt;</code></td>
    <td><code>Dictionary&lt;String, T&gt;</code></td>
    <td><code>Map&lt;String, T&gt;</code></td>
  </tr>
  <tr>
    <td><code>Error</code></td>
    <td><code>std::exception_ptr</code></td>
    <td><code>Error</code></td>
    <td><code>Throwable</code></td>
  </tr>
  <tr>
    <td><code>Promise&lt;T&gt;</code></td>
    <td><code>std::shared_ptr&lt;<a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/cpp/include/NitroModules/Promise.hpp">Promise&lt;T&gt;</a>&gt;</code></td>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/apple/core/Promise.swift">Promise&lt;T&gt;</a></code></td>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/android/src/main/java/com/margelo/nitro/core/Promise.kt">Promise&lt;T&gt;</a></code></td>
  </tr>
  <tr>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/js/src/AnyMap.ts">AnyMap</a></code></td>
    <td><code>std::shared_ptr&lt;<a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/cpp/core/AnyMap.hpp">AnyMap</a>&gt;</code></td>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/apple/core/AnyMap.swift">AnyMap</a></code></td>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/android/src/main/java/com/margelo/nitro/core/AnyMap.kt">AnyMap</a></code></td>
  </tr>
  <tr>
    <td><code>ArrayBuffer</code></td>
    <td><code>std::shared_ptr&lt;<a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/cpp/include/NitroModules/ArrayBuffer.hpp">ArrayBuffer</a>&gt;</code></td>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/apple/core/ArrayBuffer.swift">ArrayBuffer</a></code></td>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/android/src/main/java/com/margelo/nitro/core/ArrayBuffer.kt">ArrayBuffer</a></code></td>
  </tr>
  <tr>
    <td>..any <code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/js/src/HybridObject.ts">HybridObject</a></code></td>
    <td><code>std::shared_ptr&lt;<a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/cpp/include/NitroModules/HybridObject.hpp">HybridObject</a>&gt;</code></td>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/apple/core/HybridObject.swift">HybridObject</a></code></td>
    <td><code><a href="https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/android/src/main/java/com/margelo/nitro/core/HybridObject.kt">HybridObject</a></code></td>
  </tr>
  <tr>
    <td>..any <code>interface</code></td>
    <td><code>struct T</code></td>
    <td><code>struct T</code></td>
    <td><code>data class T</code></td>
  </tr>
  <tr>
    <td>..any <code>enum</code></td>
    <td><code>enum T</code></td>
    <td><code>enum T</code></td>
    <td><code>enum T</code></td>
  </tr>
  <tr>
    <td>..any <code>union</code></td>
    <td><code>enum T</code></td>
    <td><code>enum T</code></td>
    <td><code>enum T</code></td>
  </tr>
</table>
