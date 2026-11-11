---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ArrayBuffers (`ArrayBuffer`)

Array Buffers allow highly efficient access to shared raw binary data from both JS and native.
Passing an `ArrayBuffer` between JS and native is zero-copy.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    interface Image extends HybridObject<{ … }> {
      getData(): ArrayBuffer
    }
    ```

    :::note
    The `ArrayBuffer` type is built-in in JavaScript.
    :::
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridImage: HybridImageSpec {
      func getData() -> ArrayBuffer
    }
    ```

    :::note
    Import ArrayBuffer from Nitro: `import NitroModules`
    :::
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridImage: HybridImageSpec() {
      fun getData(): ArrayBuffer
    }
    ```

    :::note
    Import ArrayBuffer from Nitro: `import com.margelo.nitro.core.ArrayBuffer`
    :::
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridImage: public HybridImageSpec {
      std::shared_ptr<ArrayBuffer> getData();
    }
    ```

    :::note
    Import ArrayBuffer from Nitro: `#include <NitroModules/ArrayBuffer.hpp>`
    :::
  </TabItem>
</Tabs>

It is crucial to understand the ownership and threading concerns around shared memory access.

## Ownership

There's two kinds of `ArrayBuffer`s, **owning** and **non-owning**:

### Owning

An `ArrayBuffer` that was created on the native side is **owning** (`isOwner = true`), which means you can safely access its data as long as the `ArrayBuffer` reference is alive.
It can be safely held strong for longer, e.g. as a class property/member, and accessed from different Threads.

```swift
func doSomething() -> ArrayBuffer {
  // highlight-next-line
  let buffer = ArrayBuffer.allocate(1024 * 10)
  print(buffer.isOwner)    // <-- ✅ true
  let data = buffer.data   // <-- ✅ safe to do because we own it!
  self.buffer = buffer     // <-- ✅ safe to use it later!
  DispatchQueue.global().async {
    let data = buffer.data // <-- ✅ also safe because we own it!
  }
  return buffer
}
```

### Non-owning

An `ArrayBuffer` that was created in JS cannot be safely kept strong as the JS VM can delete it at any point, hence it is **non-owning** (`isOwner = false`).
Its data can only be safely accessed before the synchronous function returned, as this will stay within the JS bounds.

```swift
func doSomething(buffer: ArrayBuffer) {
  print(buffer.isOwner)    // <-- ❌ false
  let data = buffer.data   // <-- ✅ safe to do because we're still sync
  DispatchQueue.global().async {
    // code-error
    let data = buffer.data // <-- ❌ NOT safe
  }
}
```
If you need a non-owning buffer's data for longer, **copy it first**:
```swift
func doSomething(buffer: ArrayBuffer) {
  // diff-add
  let copy = buffer.isOwner
  // diff-add
      ? buffer
  // diff-add
      : ArrayBuffer.copy(of: buffer)
  let data = copy.data   // <-- ✅ safe now because we have an owning copy
  DispatchQueue.global().async {
    let data = copy.data // <-- ✅ still safe now because we have an owning copy
  }
}
```

:::note
Not every `ArrayBuffer` received from JS is **non-owning**, eg if the buffer was created in native and then did a JS-roundtrip it is still **owning**!

Always check the `isOwner` property to prevent unnecessary copies.
:::

## Threading

An `ArrayBuffer` can be accessed from both JS and native, and even from multiple Threads at once, but they are **not thread-safe**.
To prevent race conditions or garbage-data from being read, make sure to not read from- and write to- the `ArrayBuffer` at the same time.

## Creating Buffers

Buffers can either be created from native (**owning**), or from JS (**non-owning**).

### From native

On the native side, an **owning** `ArrayBuffer` can either **wrap-**, or **copy-** an existing buffer:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift">
    ```swift
    let myData = UnsafeMutablePointer<UInt8>.allocate(capacity: 4096)

    // wrap (no copy)
    let wrappingArrayBuffer = ArrayBuffer.wrap(dataWithoutCopy: myData,
                                               size: 4096,
                                               onDelete: { myData.deallocate() })
    // copy
    let copiedArrayBuffer = ArrayBuffer.copy(of: wrappingArrayBuffer)
    // new blank buffer
    let newArrayBuffer = ArrayBuffer.allocate(size: 4096)
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    val myData = ByteBuffer.allocateDirect(4096)

    // wrap (no copy)
    val wrappingArrayBuffer = ArrayBuffer.wrap(myData)


    // copy
    let copiedArrayBuffer = ArrayBuffer.copy(myData)
    // new blank buffer
    val newArrayBuffer = ArrayBuffer.allocate(4096)
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    auto myData = new uint8_t[4096];

    // wrap (no copy)
    auto wrappingArrayBuffer = ArrayBuffer::wrap(myData, 4096, [=]() {
      delete[] myData;
    });
    // copy
    auto copiedArrayBuffer = ArrayBuffer::copy(myData, 4096);
    // new blank buffer
    auto newArrayBuffer = ArrayBuffer::allocate(4096);
    ```
  </TabItem>
</Tabs>

#### Language-native buffer types

ArrayBuffers also provide helper and conversion methods for the language-native conventional buffer types:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift">
    Swift often uses [`Data`](https://developer.apple.com/documentation/foundation/data) to represent Data.
    ```swift
    let data = Data(capacity: 1024)
    let buffer = ArrayBuffer.copy(data: data)
    let dataAgain = buffer.toData(copyIfNeeded: true)
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    Kotlin often uses [`ByteBuffer`](https://developer.android.com/reference/java/nio/ByteBuffer) to represent Data.
    ```kotlin
    val data = ByteBuffer.allocateDirect(1024)
    val buffer = ArrayBuffer.copy(data)
    val dataAgain = buffer.getBuffer(copyIfNeeded = true)
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    C++ often uses [`std::vector<uint8_t>`](https://en.cppreference.com/w/cpp/container/vector) to represent Data.
    ```cpp
    std::vector<uint8_t> data;
    auto buffer = ArrayBuffer::copy(data);
    /* convert back to vector would be a copy. */
    ```
  </TabItem>
</Tabs>

### From JS

From JS, a **non-owning** `ArrayBuffer` can be created via the [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) web APIs, and viewed or edited using the typed array APIs (e.g. [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)).

```ts
const arrayBuffer = new ArrayBuffer(4096)
const view = new Uint8Array(arrayBuffer)
view[0] = 64
view[1] = 128
view[2] = 255
```

#### Creating a native buffer from JS

To create an **owning** `ArrayBuffer` from JS, you can use the `createNativeArrayBuffer(size)` helper:

```ts
const arrayBuffer = NitroModules.createNativeArrayBuffer(4096)
```

In contrast to using the default JS `ArrayBuffer` constructor, this allocates a native `ArrayBuffer` using Nitro's implementation, allowing you to use this buffer in native, without performing any copies as it already is **owning**.
