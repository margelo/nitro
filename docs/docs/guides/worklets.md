---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Worklets/Threading

Nitro itself is fully runtime-agnostic, which means every [Hybrid Object](../concepts/hybrid-objects) can be used from any JS Runtime or Worklet Context.

This allows the caller to call into native Nitro Modules from libraries like [react-native-worklets-core](https://github.com/margelo/react-native-worklets-core), or [react-native-reanimated](https://github.com/software-mansion/react-native-reanimated).
You can use a Nitro [Hybrid Object](../concepts/hybrid-objects) on the default React JS context, on the UI context, or on any other background worklet context.

<Tabs groupId="worklet-library">
  <TabItem value="rnw" label="react-native-worklets (Reanimated)" default>
  ```ts
  const math = NitroModules.createHybridObject<Math>('Math')
  runOnUI(() => {
    'worklet'
    const result = math.add(5, 3)
    console.log(result) // --> 8
  })()
  ```
  </TabItem>
  <TabItem value="rnwc" label="react-native-worklets-core (Margelo)">
  ```ts
  const math = NitroModules.createHybridObject<Math>('Math')
  const boxed = NitroModules.box(math)

  const context = Worklets.createContext('DummyContext')
  context.runAsync(() => {
    'worklet'
    const unboxed = boxed.unbox()
    const result = unboxed.add(5, 3)
    console.log(result) // --> 8
  })
  ```
  </TabItem>
</Tabs>

## Dispatcher

All synchronous APIs of Nitro work ✨ automagically ✨ on any runtime, but asynchronous APIs (Promises and callbacks) require a `Dispatcher`.
If you call an asynchronous API on a runtime that Nitro doesn't know, it likely doesn't have a `Dispatcher`, so it doesn't know how to call back to the JS Thread after the asynchronous operation has finished (Promise resolve or callback call).

If **you** created that `jsi::Runtime`, you need to create a `Dispatcher` for it and implement `runSync` and `runAsync`:

```cpp
#include <NitroModules/Dispatcher.hpp>
using namespace margelo::nitro;

class MyRuntimeDispatcher: public Dispatcher {
public:
  void runSync(std::function<void()>&& function) override;
  void runAsync(std::function<void()>&& function) override;
};
```

Then, simply install this `Dispatcher` into your runtime so Nitro can use it:

```cpp
auto myDispatcher = std::make_shared<MyRuntimeDispatcher>();
Dispatcher::installRuntimeGlobalDispatcher(myRuntime, myDispatcher);
```

This needs to be done once, ideally immediately after creating the `jsi::Runtime`.

Your `runSync` and `runAsync` implementations must run the given `function` on the same Thread that the `jsi::Runtime` was created on - see [`CallInvokerDispatcher.hpp`](https://github.com/margelo/nitro/blob/core-split/packages/nitro-core/native/cpp/threading/CallInvokerDispatcher.hpp) for an example.

### react-native-worklets runtimes

If you created the runtime with [react-native-worklets](https://github.com/software-mansion/react-native-reanimated/tree/main/packages/react-native-worklets) (`createWorkletRuntime(...)`), your `Dispatcher` can schedule onto that runtime's own queue using `WorkletRuntime::schedule(...)`:

```cpp
#include <NitroModules/Dispatcher.hpp>
#include <worklets/WorkletRuntime/WorkletRuntime.h>
using namespace margelo::nitro;

class WorkletRuntimeDispatcher: public Dispatcher {
public:
  explicit WorkletRuntimeDispatcher(std::weak_ptr<worklets::WorkletRuntime> runtime): _runtime(std::move(runtime)) {}

  void runSync(std::function<void()>&&) override {
    throw std::runtime_error("runSync(...) is not implemented for WorkletRuntimeDispatcher!");
  }
  void runAsync(std::function<void()>&& function) override {
    if (auto runtime = _runtime.lock()) {
      runtime->schedule([function = std::move(function)](facebook::jsi::Runtime&) { function(); });
    }
  }

private:
  std::weak_ptr<worklets::WorkletRuntime> _runtime;
};
```

The `jsi::Runtime` holds a strong reference to its `Dispatcher`, so the `Dispatcher` holds the `WorkletRuntime` weakly to avoid a reference cycle.

Install it from a [raw method](../types/raw-jsi-value) that you call on the worklet runtime:

```cpp
auto workletRuntime = worklets::WorkletRuntime::getWeakRuntimeFromJSIRuntime(runtime);
auto dispatcher = std::make_shared<WorkletRuntimeDispatcher>(workletRuntime);
Dispatcher::installRuntimeGlobalDispatcher(runtime, dispatcher);
```

## Boxing

A [Hybrid Object](../concepts/hybrid-objects) is a JS object with `jsi::NativeState` and a prototype chain.
If you need to interop with legacy APIs or APIs that can't deal with `jsi::NativeState` yet, you can _box_ the Hybrid Object into a `jsi::HostObject`:

```ts
const math = NitroModules.createHybridObject<Math>('Math')
const boxed = NitroModules.box(math) // <-- jsi::HostObject
```

The `boxed` object is a simple `jsi::HostObject` (see [`BoxedHybridObject.hpp`](https://github.com/margelo/nitro/blob/core-split/packages/nitro-core/native/cpp/core/BoxedHybridObject.hpp)), which can later be _unboxed_ again:

```ts
const unboxed = boxed.unbox()    // <-- Math
const result = unboxed.add(5, 3) // <-- 8
```

:::info
This is how Hybrid Objects are captured inside Worklet Contexts under the hood as well!
:::
