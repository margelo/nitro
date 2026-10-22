---
description:
  Improve Nitro Module performance by choosing static types, efficient Hybrid Object APIs, and lower-overhead native binding patterns.
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# Performance Tips

While Nitro is already insanely fast, there are some things you can do that affect the performance of your library. Here are some tips to
make your library even faster.

## Avoid dynamic types

Any dynamic types require runtime type checking, and cannot be optimized as good as statically known types (compile-time).

### JSON values (`AnyJSON`)

An [AnyJSON value](../types/any-json) is serialized as JSON when crossing the JS/native boundary. Use a typed struct when you know its
fields:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
@Apple(...)
export declare class BadDatabase extends HybridObject {
  getUser(): AnyJSON
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
interface User {
  name: string
  age: number
}
@Apple(...)
export declare class GoodDatabase extends HybridObject {
  getUser(): User
}
```

</div>
</div>

In some cases (e.g. network requests) you do not know the shape of your data, like in a JSON web-request. In this case, it might make sense
to use `ArrayBuffer` or `string`, and parse the data on the JS side using `JSON.parse` - benchmark your code (before vs after) to see if
this optimization makes sense for you.

### Variants

[Variants](../types/variants) (`A | B`) are dynamic types. Each time you pass a variant to native, Nitro has to check its type at runtime -
is it `A` or `B`? Those type-checks are very efficient so this is considered a micro-optimization, but if you can, avoid variants like so:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
@Apple(...)
export declare class BadDatabase extends HybridObject {
  set(value: number | string): void
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
@Apple(...)
export declare class GoodDatabase extends HybridObject {
  setNumber(value: number): void
  setString(value: string): void
}
```

</div>
</div>

## Avoid unnecessary objects

It is a common pattern to wrap everything in an object in JavaScript. In Nitro, every object gets its own struct and has to be allocated. On
Apple platforms this performance impact is almost zero, but on Android the struct is a heap-allocation.

If you can, avoid unnecessarily wrapping everything in objects, and flatten the types out in the function signature:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
interface SetPayload {
  key: string
  value: string
  onCompleted: () => void
}
@Apple(...)
export declare class BadDatabase extends HybridObject {
  set(payload: SetPayload): void
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
@Apple(...)
export declare class GoodDatabase extends HybridObject {
  set(key: string,
      value: string,
      onCompleted: () => void): void
}
```

</div>
</div>

## Use inline callbacks when possible

If a callback is only used during the current native call, mark it as [`Inline<...>`](../types/callbacks#inline-callbacks):

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
import { type HybridObject, Apple } from 'nitro-core'

@Apple(...)
export declare class BadDatabase extends HybridObject {
  forEachRow(callback: (row: Row) => void): void
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
import { type HybridObject, type Inline, Apple } from 'nitro-core'

@Apple(...)
export declare class GoodDatabase extends HybridObject {
  forEachRow(callback: Inline<(row: Row) => void>): void
}
```

</div>
</div>

In Swift and C++, this lets Nitro borrow the JS function for the duration of the call, avoiding the allocations needed to keep an ordinary
`Callback` alive for later. Calling it inline also skips the Dispatcher and calls JS directly.

This only makes sense if you actually execute the callback inline, before the native method returns and on the calling JS Runtime's Thread.
If you need to store it or call it from another Thread, use an ordinary callback or call `escape()` first. Escaping creates an owning
`Callback` again, so always escaping an `Inline<...>` callback loses this optimization.

## Use static methods for stateless functions

If a method does not need any instance state, make it `static`:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
@Apple(...)
export declare class BadHasher extends HybridObject {
  constructor()
  hash(data: ArrayBuffer): string
}
export * from '#nitro/BadHasher'

const hasher = new BadHasher()
const hash = hasher.hash(data)
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
@Apple(...)
export declare class GoodHasher extends HybridObject {
  static hash(data: ArrayBuffer): string
}
export * from '#nitro/GoodHasher'

const hash = GoodHasher.hash(data)
```

</div>
</div>

Every instance call has to look up the native object behind `this`, check its type, and keep it alive for the duration of the call. Static
methods skip that work. You also avoid creating a Hybrid Object just to call a stateless function.

This reduces the overhead of the call itself - it does not make the actual hashing code faster. Keep instance methods when your object has
state, like an open database connection or a configured image decoder. Static methods require a concrete
[`implementation`](../concepts/platform-decorators#concrete-implementations) in the platform decorators.

## Use concrete implementations and disable inheritance

If your Hybrid Object has one known native implementation, specify it in the platform decorator. Only enable inheritance or multiple
implementations when you actually need them:

```ts title="Image.nitro.ts"
import { type HybridObject, Apple } from 'nitro-core'

@Apple({
  language: 'swift',
  implementation: { className: 'HybridImage' },
  allowInheritance: false,
})
export declare class Image extends HybridObject {
  readonly width: number
  readonly height: number
}
export * from '#nitro/Image'
```

In Swift, a concrete `implementation` lets the bridge hold `HybridImage` directly, instead of going through an `any HybridImageSpec`
protocol value on each call. This gives the compiler more opportunities to optimize calls to your implementation.

With `allowInheritance: false`, Nitrogen also generates final Swift and C++ bridge classes. Nitro can then check the receiver's exact type
instead of searching its inheritance hierarchy when calling an instance method. `allowInheritance` is already `false` by default, so you can
also just omit it.

These are small optimizations that matter most for methods called very often. Benchmark your code to see how much they affect your library.

## Avoid repeated native downcasts

If you do need multiple implementations, you might find yourself repeatedly downcasting a Hybrid Object to access its native properties -
for example, `image as? HybridImage` to get its underlying `UIImage`.

Put those shared native properties in a Swift protocol or Kotlin interface, and add it through `protocolConformances` or
`implementedInterfaces`. Now every implementation has to provide those properties, and your native code can access them directly without
checking which concrete class it received.

See [Additional native interface/protocol conformances](../concepts/platform-decorators#additional-native-interfaceprotocol-conformances)
for an example.

## Use Threading/Asynchronous Promises

By default, every function in Nitro is fully synchronous. If your function takes long to execute, the JS Thread can not do any other work in
the meantime.

In such cases, mark your function asynchronous by returning a [`Promise`](../types/promises), which you can then use to run the heavy
processing code on a different thread:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
@Apple(...)
export declare class BadDatabase extends HybridObject {
  writeLargeData(data: string): void
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
@Apple(...)
export declare class GoodDatabase extends HybridObject {
  writeLargeData(data: string): Promise<void>
}
```

</div>
</div>

Keep in mind that switching to a different Thread on the native side introduces a small overhead by itself. This only benefits performance
if the actual computation inside the function body takes longer than the thread-switch.

## Use `ArrayBuffer` for large data

For large data sets, conventional [arrays](../types/arrays) are in-efficient as each value has to be copied individually. In contrast to
conventional arrays, [Array Buffers](../types/array-buffers) are zero-copy, meaning native memory can be directly shared to JS without
copying the data.

For example, to return a large list of numbers we could use [array buffers](../types/array-buffers) (`Float64Array`) instead of
[arrays](../types/arrays):

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
@Apple(...)
export declare class BadDatabase extends HybridObject {
  getAsBlob(): number[]
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
@Apple(...)
export declare class GoodDatabase extends HybridObject {
  getAsBlob(): ArrayBuffer
}
```

</div>
</div>

## Use Hybrid Objects to implement proxy-results

If a function returns a large amount of data to JS, but only a sub-set of that data is used, we can implement it as a
[Hybrid Object](../types/hybrid-objects) instead of a [struct](../types/custom-structs).

This way data will be accessed lazily, and all the data that the user does not access will never be converted to JS, which means Nitro has
to do less work:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
interface AllData {
  rows: DataRow[]
}


@Apple(...)
export declare class BadDatabase extends HybridObject {
  getAllData(): AllData
}

const database = // ...
const data = database.getAllData()
const row = data.rows
  .find((r) => r.name === "Marc")
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
@Apple(...)
export declare class AllData extends HybridObject {
  findRowWithName(name: string): DataRow
}

@Apple(...)
export declare class GoodDatabase extends HybridObject {
  getAllData(): AllData
}

const database = // ...
const data = database.getAllData()
const row = data.findRowWithName("Marc")
```

</div>
</div>

The **Bad** example is significantly slower than **Good**, because Nitro has to convert **all rows** to JS, and there could be thousands of
rows - even if we only use the row with the `name` "Marc".

The **Good** example is significantly faster than **Bad** because the result of `getAllData()` is a
[Hybrid Object](../types/hybrid-objects), and all the thousands of rows do not have to be converted to JS at all, instead they are simply
held in native memory. The function `findRowWithName(...)` iterates through the list on the native side and finds the matching row - only
this single row will then have to be converted to JS.

## Properly use `memorySize`

Since Hybrid Objects are implemented in native code, the JS runtime does not know the memory size of such objects. To let the JavaScript
runtime know about a Hybrid Object's actual size in memory, Nitro exposes a `memorySize` (or `getExternalMemorySize()` in C++) API which you
can use to estimate the native object's memory size, including any heap allocations you perform:

```swift
class HybridImage : HybridImageSpec {
  private let cgImage: CGImage

  init(cgImage: CGImage) throws {
    self.cgImage = cgImage
    try super.init()
  }

  var memorySize: Int {
    return cgImage.bytesPerRow * cgImage.height
  }
}
```

That way the JS garbage collector knows how big an `Image` is exactly in memory, and can delete any unused `Image` objects sooner to free up
the native memory (`cgImage`), potentially avoiding memory warnings or garbage collector panics.

## Implement view recycling (`RecyclableView`)

If a view is rendered multiple times throughout an app's lifetime, Fabric can recycle old views and re-use them to display new views. This
requires you to reset your internal state to its default values, otherwise stale views may show up, so recycling is disabled by default. To
enable recycling, implement the `RecyclableView` interface/protocol, and override the `prepareForRecycle()` method:

<Tabs groupId="native-view-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMyView.swift"
    import NitroModules

    class HybridMyView: HybridMyViewSpec, RecyclableView {
      // ...
      func prepareForRecycle() {}
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMyView.kt"
    import com.margelo.nitro.views.RecyclableView

    class HybridMyView: HybridMyViewSpec(), RecyclableView {
      companion object : HybridMyViewSpec.Companion {}

      // ...
      override fun prepareForRecycle() {}
    }
    ```

  </TabItem>

</Tabs>

See [View Components: Recycling](view-components#recycling) for more information.

## Avoid too many native calls

While Nitro is insanely fast, there is still an unavoidable overhead associated with calling native code from JS. In general, it is a good
practice to stay within one environment (here; JavaScript) as long as possible, and only call into native when really needed.

Some things (like the `Math.add(...)` function I often use) are faster in JavaScript, as the overhead of calling into native might be
greater than the overall execution time of the function.

## Use C++ if possible

If possible, write Nitro Modules in C++. This is faster as bridging to Swift or Kotlin is not required.

## Avoid large arrays

Large arrays have to be deep-copied, as they are immutable memory in JS. If possible, avoid sending large arrays back and forth - this is
the same principle as ["Use Hybrid Objects to implement proxy-results"](#use-hybrid-objects-to-implement-proxy-results).
