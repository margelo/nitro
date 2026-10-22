---
description:
  Learn what React Native Nitro Modules are and how Nitro uses JSI, C++, Swift, Kotlin, and Nitrogen to build fast type-safe native modules.
---

# What is Nitro?

Nitro is a framework for building powerful and fast native modules for JS. Simply put, a JS object can be implemented in C++, Swift or
Kotlin instead of JS by using Nitro.

While Nitro's primary environment is React Native, it also works in any other environment that uses JSI.

- A [**Nitro Module**](../concepts/nitro-modules) is a library built with Nitro. It contains one or more **Hybrid Objects**.
- A [**Hybrid Object**](../concepts/hybrid-objects) is a native object in Nitro, implemented in either C++, Swift or Kotlin.
- [**Nitrogen**](../concepts/nitrogen) is an optional code-generator library authors can use to generate native bindings from a TypeScript
  class.

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Math.nitro.ts"
@Apple({
  language: 'swift',
  implementation: { className: 'HybridMath' },
})
export declare class Math extends HybridObject {
  static add(a: number, b: number): number
}
export * from '#nitro/Math'
```

</div>
<div className="side-by-side-block">

```swift title="HybridMath.swift"
class HybridMath : HybridMathSpec {
  static func add(a: Double, b: Double) -> Double {
    return a + b
  }
}
```

</div>
</div>

This Hybrid Object can then be accessed directly from JS:

```ts
import { Math } from './Math.nitro'

const result = Math.add(5, 7)
```

## Performance

Nitro is all about **performance**. [This benchmark](https://github.com/mrousavy/NitroBenchmarks) compares the total execution time when
calling a single native method 100.000 times:

<table>
  <tr>
    <th></th>
    <th>ExpoModules</th>
    <th>TurboModules</th>
    <th>NitroModules</th>
  </tr>
  <tr>
    <td>100.000x <code>addNumbers(...)</code></td>
    <td>434.85ms</td>
    <td>115.86ms</td>
    <td><b>7.27ms</b></td>
  </tr>
  <tr>
    <td>100.000x <code>addStrings(...)</code></td>
    <td>429.53ms</td>
    <td>179.02ms</td>
    <td><b>29.94ms</b></td>
  </tr>
</table>

Note: These benchmarks only compare native method throughput in extreme cases, and do not necessarily reflect real world use-cases. In a
real-world app, results may vary. See [NitroBenchmarks](https://github.com/mrousavy/NitroBenchmarks) for full context.

### Lightweight layer

While Nitro is built on top of JSI, the layer is very lightweight and efficient. Many things like type-checking is compile-time only, and
built with C++ templates or `constexpr` which introduces zero runtime overhead.

### Direct Swift &lt;&gt; C++ interop

Unlike Turbo- or Expo-Modules, Nitro-Modules does not use Objective-C at all. Nitro is built using the new
[Swift &lt;&gt; C++ interop](https://www.swift.org/documentation/cxx-interop/), which is close to zero-overhead.

### Uses `jsi::NativeState`

Hybrid Objects in Nitro are built on top of `jsi::NativeState`, which is more efficient than `jsi::HostObject`. Such objects have proper
native prototypes, and their native memory size is known, which allows the garbage collector to properly clean up unused objects.

## Type Safety

Nitro Modules are **type-safe** and **null-safe**. By using Nitro's code-generator, [nitrogen](../concepts/nitrogen), TypeScript specs are
the single source of truth as generated native interfaces have to exactly represent the declared types. If a function declares a `number`,
you can only implement it on the native side as a `Double`, otherwise the app will not compile.

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Math.nitro.ts"
@Apple(...)
export declare class Math extends HybridObject {
  static add(a: number, b: number): number
}
export * from '#nitro/Math'
```

</div>
<div className="side-by-side-block">

```swift title="HybridMath.swift"
class HybridMath : HybridMathSpec {
  static func add(a: Double, b: Double) -> String {
// code-error
//  Compile-error: Expected Double! ^
    return a + b
  }
}
```

</div>
</div>

### Null-safety

There is no way for a Nitro Module to return a type that is not expected in TypeScript, which also guarantees null-safety.

```ts
@Apple(...)
export declare class Math extends HybridObject {
  static getValue(): number
  static getValueOrNull(): number | undefined
}
export * from '#nitro/Math'
```

## Object-Oriented approach

Every Hybrid Object in Nitro is a native object, which can be created, passed around, and destroyed.

```ts
@Apple(...)
export declare class Image extends HybridObject {
  constructor(bytes: ArrayBuffer)
  readonly width: number
  readonly height: number
  saveToFile(path: string): Promise<void>
}
export * from '#nitro/Image'

@Apple(...)
export declare class ImageEditor extends HybridObject {
  static crop(image: Image, size: Size): Image
}
export * from '#nitro/ImageEditor'
```

The `Image`'s `constructor` allows construction from JS:

```ts
import { Image, ImageEditor } from './Image.nitro'

const image = new Image(IMAGE_BYTES)
const cropped = ImageEditor.crop(image, { width: 24, height: 24 })
```

Functions (or "callbacks") are also first-class citizens of Nitro, which means they can safely be kept in memory, called as often as needed,
and will automatically be cleaned up when no longer needed. This is somewhat similar to how other frameworks (like Turbo-Modules) implement
"events".

## Modern Languages

Nitro is a modern framework, built on top of modern languages like Swift and Kotlin. It has first-class support for modern language
features.

### Swift

Nitro bridges to Swift directly using the new highly efficient
[Swift &lt;&gt; C++ interop](https://www.swift.org/documentation/cxx-interop/).

- **Protocols**: Every Hybrid Object's generated specification is a
  [Swift protocol](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/protocols/).
- **Properties**: A getter (and setter) property can be implemented using
  [Swift properties](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/properties/).
- **Async**/**Await**: Asynchronous functions can use Swift's new
  [async/await syntax](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/) using `.async { ... }`
  on an `any Promise<T>` return type.
- **No Objective-C**: Instead of bridging through Objective-C interfaces, Nitro bridges to Swift directly from C++.

### Kotlin

Nitro bridges to Kotlin directly using [fbjni](https://github.com/facebookincubator/fbjni).

- **Interfaces**: Every Hybrid Object's generated specification is a [Kotlin interface](https://kotlinlang.org/docs/interfaces.html).
- **Properties**: A getter (and setter) property can be implemented using [Kotlin properties](https://kotlinlang.org/docs/properties.html).
- **Coroutines**: Asynchronous functions can use Kotlin's [coroutine syntax](https://kotlinlang.org/docs/coroutines-overview.html) using the
  `Promise.async` API.
- **No Java**: Instead of requiring Java classes, Nitro bridges to Kotlin directly.
