---
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# Callbacks (`(...) => T`)

Callbacks are functions created in one language and passed to another to provide a way to "call back" later.

Nitro has a clever reference counting system to allow users to use callbacks/functions from JS safely, and without any limitations. Each
callback holds a strong reference on the native side and can be called as often as needed. Once the callback is no longer used, it will be
safely deleted from memory.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    import { type HybridObject, Apple } from 'nitro-core'

    @Apple(...)
    export declare class Server extends HybridObject {
      start(onNewUserJoined: (user: User) => void): void
    }
    ```

  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    func start(onNewUserJoined: any Callback<User, Void>) {
      onNewUserJoined(user)
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    fun start(onNewUserJoined: Callback<User, Void>) {
      onNewUserJoined(user)
    }
    ```

  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    void start(const Callback<void(const User&)>& onNewUserJoined) {
      onNewUserJoined(user);
    }
    ```

  </TabItem>

</Tabs>

## Events

Since callbacks can be safely kept in memory for longer and called multiple times, Nitro does not have a special type for an "event". It is
simply a function you store in memory and call later, just like in a normal JS class. ✨

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    type Orientation = "portrait" | "landscape"
    @Apple(...)
    export declare class DeviceInfo extends HybridObject {
      listenToOrientation(onChanged: (o: Orientation) => void): void
    }
    export * from '#nitro/DeviceInfo'

    const deviceInfo = // ...
    deviceInfo.listenToOrientation((o) => {
      console.log(`Orientation changed to ${o}!`)
    })
    ```

  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    func listenToOrientation(onChanged: any Callback<Orientation, Void>) {
      self.listeners.append(onChanged)
    }

    func onRotate() {
      for listener in self.listeners {
        listener(newOrientation)
      }
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    fun listenToOrientation(onChanged: Callback<Orientation, Unit>) {
      this.listeners.add(onChanged)
    }

    fun onRotate() {
      for (listener in this.listeners) {
        listener(newOrientation)
      }
    }
    ```

  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    void listenToOrientation(const Callback<void(Orientation)>& onChanged) {
      this->listeners.push_back(onChanged);
    }

    void onRotate() {
      for (const auto& listener: this->listeners) {
        listener(newOrientation);
      }
    }
    ```

  </TabItem>

</Tabs>

## Callbacks that return a value (`(...) => T`)

A `Callback` can also return a value:

```ts title="Math.nitro.ts"
@Apple(...)
export declare class Math extends HybridObject {
  calculate(getValue: () => number): void
}
export * from '#nitro/Math'
```

Since JS callbacks could theoretically be called from any native Thread, callbacks are called asynchronously by default:

```swift title="HybridMath.swift"
class HybridMath: HybridMathSpec {
  func calculate(getValue: any Callback<(), Double>) {
    Task {
      let result = try await getValue() // Double
    }
  }
}
```

## Async by default, sync when needed

`Callback` has three calling conventions:

```swift
func call(callback: any Callback<(), Void>) throws {
  callback.callAsync()     // Promise<Void>
  try callback.callSync()  // Void (blocking)
  callback.callAndForget() // Void
}
```

In synchronous code, the call operator chooses `callAndForget()` when the callback returns `Void`, or returns a `Promise` when it returns a
value. In async code, `try await callback(...)` waits for the result and propagates errors, just like `try await callback.callAsync(...)`.
These Swift async overloads require a `Sendable` result. Use `callAndForget()` explicitly to fire and forget from an async function.

```swift
func callVoid(callback: any Callback<(), Void>) {
  callback()               // Void (just like callAndForget())
}
func callResult(callback: any Callback<(), Double>) {
  callback()               // Promise<Double> (just like callAsync())
}
func callResultAsync(callback: any Callback<(), Double>) async throws {
  let result = try await callback() // Double
}
```

:::warning

For a JS callback, `callSync()` must be called on the thread of the JS Runtime the callback came from.

:::

Sharing a callback handle does not synchronize mutable arguments or results. See
[Threads and shared objects](../guides/sync-vs-async#threads-and-shared-objects).

## Inline Callbacks

If your callback never escapes the calling function, use `Inline<...>` as a performance optimization:

```ts title="Math.nitro.ts"
@Apple(...)
export declare class Math extends HybridObject {
  calculate(getValue: Inline<() => number>): void
}
export * from '#nitro/Math'
```

`InlineCallback<...>` allows you to call back to JS inline, or escape to a `Callback<...>` just like before:

```swift title="HybridMath.swift"
class HybridMath: HybridMathSpec {
  func calculate(getValue: borrowing some InlineCallback<(), Double> & ~Copyable & ~Escapable) throws {
    let result = try getValue()              // Double
    let callbackForLater = getValue.escape() // any Callback<(), Double>
  }
}
```

## How was it before Nitro?

Conventionally (in legacy React Native Native Modules), a native method could only have a maximum of two callbacks, one "success" and one
"failure" callback. Once one of these callbacks is called, both will be destroyed and can no longer be called later. This is why React
Native introduced "Events" as a way to call into JS more than just once. This also meant that an asynchronous function could not have any
callbacks, since a Promise's resolve and reject functions are already two callbacks. For example, this was **not possible**:

```ts
interface Camera {
  startRecording(
    onStatusUpdate: () => void,
    // code-error
    onRecordingFailed: () => void,
    // code-error
    onRecordingFinished: () => void
  ): Promise<void>
}
```

Thanks to Nitro's clever reference system, functions can be safely held in memory and called as many times as you like, just like in a
normal JS class. This makes "Events" obsolete, and allows using as many callbacks per native method as required.
