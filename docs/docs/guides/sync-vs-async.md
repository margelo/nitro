---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Sync vs Async

By default, every method on a [Hybrid Object](../concepts/hybrid-objects) is synchronous and runs on the JS Thread.
This means, as long as your native method is executing, the JS Thread is blocked and can not do any other work (like state updates or view changes).

## Light Methods

For small/light methods this is great because you can return results to the caller (JS) immediately without having to await a Promise.

For example, [react-native-mmkv](https://github.com/margelo/react-native-mmkv) allows you to _get_ values synchronously:

```ts
function App() {
  const mmkv = new MMKV()
  const name = mmkv.getString('username') // --> Marc
}
```

If it would be async, it would be quite cumbersome to use in some contexts:

```ts
function App() {
  const mmkv = new MMKV()
  const [name, setName] = useState(undefined)

  useEffect(() => {
    (async () => {
      const n = await mmkv.getString('username') // --> Marc
      setName(n)
    })()
  }, [])
}
```

## Heavy Methods

For larger/heavy methods that take a while to execute this can be problematic, because the JS Thread will be blocked for a longer duration then.

To free up the JS Thread while the long-running method is executing, you can make it **asynchronous** by just returning a `Promise`:

```ts title="MinerSpec.nitro.ts"
interface Miner extends HybridObject<{ … }> {
  mineOneBitcoin(): Promise<number>
}
```

On the native side you still start out with a synchronous method, but you can return a Promise:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMiner.swift"
    func mineOneBitcoin() throws -> Promise<Double> {
      // 1. synchronous in here, JS Thread is still blocked
      //    useful e.g. for argument checking before starting async Thread
      return Promise.async {
        // 2. asynchronous in here, JS Thread is now free
        return computeBitcoin()
      }
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMiner.kt"
    override fun mineOneBitcoin(): Promise<Double> {
      // 1. synchronous in here, JS Thread is still blocked
      //    useful e.g. for argument checking before starting async Thread
      return Promise.async {
        // 2. asynchronous in here, JS Thread is now free
        return computeBitcoin()
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp title="HybridMiner.hpp"
    std::shared_ptr<Promise<double>> mineOneBitcoin() override {
      // 1. synchronous in here, JS Thread is still blocked
      //    useful e.g. for argument checking before starting async Thread
      return Promise<double>::async([]() {
        // 2. asynchronous in here, JS Thread is now free
        return computeBitcoin();
      });
    }
    ```
  </TabItem>
</Tabs>

## When should it be async?

It's up to you to decide when to make a native method asynchronous.
Benchmark the total execution time of your method - a good rule of thumb is: _if it takes longer than 50ms, make it asynchronous_.

## Why isn't everything async?

There's two reasons:

1. Jumping from one thread (JS) to another (background) introduces a tiny overhead. Sometimes the total execution time of the method itself is smaller than just the Thread-jump, so it would make more sense to just keep it synchronous right away.
2. For small/fast methods it's more ergonomic to keep them synchronous as the caller receives the return value right away - no awaiting or Promises.
