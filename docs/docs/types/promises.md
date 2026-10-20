---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Promises (`Promise<T>`)

A function can be made asynchronous by returning a `Promise` to JS.
This allows your native code to perform heavy-, long-running tasks in parallel, while the JS thread can continue rendering and performing other business logic.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    In TypeScript, a `Promise<T>` is represented using the built-in `Promise<T>` type, which can be awaited:

    ```ts
    import { type HybridObject, iOS } from 'nitro-core'

    @iOS(...)
    export declare class Math extends HybridObject {
      fibonacci(n: number): Promise<number>
    }

    const math = // ...
    await math.fibonacci(13)
    ```

    :::note
    The `Promise<T>` type is built-in in JavaScript.
    :::
  </TabItem>
  <TabItem value="swift" label="Swift">
    In Swift, a `Promise<T>` can be created via Nitro's [`Promise<T>`](https://github.com/margelo/nitro/blob/v1/packages/nitro-core/native/apple/core/Promise.swift) type - for example, to use Swift's new async/await syntax:

    ```swift
    func fibonacci(n: Double) -> any Promise<Double> {
      return .async {
        // This runs in a Swift Task and can await asynchronous work.
        return try await calculateFibonacciSequence(n)
      }
    }
    ```

    :::note
    Import Promise from Nitro: `import NitroModules`
    :::
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    In Kotlin, a `Promise<T>` can be created via Nitro's [`Promise<T>`](https://github.com/margelo/nitro/blob/v1/packages/nitro-core/native/android/src/main/java/com/margelo/nitro/core/Promise.kt) type - for example, to use Kotlin's coroutine syntax:

    ```kotlin
    fun fibonacci(n: Double): Promise<Double> {
      return Promise.async {
        // This runs on a separate Thread, and can use suspending coroutine functions!
        return@async calculateFibonacciSequence(n)
      }
    }
    ```

    :::note
    Import Promise from Nitro: `import com.margelo.nitro.core.Promise`
    :::
  </TabItem>
  <TabItem value="cpp" label="C++">
    In C++, a `Promise<T>` can be created via Nitro's [`Promise<T>`](https://github.com/margelo/nitro/blob/v1/packages/nitro-core/native/cpp/include/NitroModules/Promise.hpp) type - for example, to use an asynchronous Thread pool:

    ```cpp
    Promise<double> fibonacci(double n) {
      return Promise<double>::async([=]() -> double {
        // This runs on a separate Thread!
        return calculateFibonacciSequence(n);
      });
    }
    ```

    :::note
    Import Promise from Nitro: `#include <NitroModules/Promise.hpp>`
    :::
  </TabItem>
</Tabs>

Additionally, Nitro statically enforces that **Promises can never go stale**, preventing you from accidentally "forgetting" to resolve or reject a Promise:

```swift title="HybridMath.swift"
func saveToFile(image: HybridImage) -> any Promise<Void> {
  guard let data = image.data else { return }
  // code-error
                                     ^ // Error: Cannot return void!
  return .async {
    try await data.writeToFile("file://tmp/img.png")
  }
}
```

In Swift, `Promise<T>` is a protocol. Use `any Promise<T>` in signatures and contextual factories such as `.async { ... }`, `.parallel { ... }`, `.resolved(with: value)`, or `.rejected(with: error)`. Nitrogen generates these factories for the promise types used by your specs.
