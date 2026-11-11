---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Errors

Every method in a [Hybrid Object](../concepts/hybrid-objects) can throw an error using the language-default error throwing feature:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMath.swift"
    class HybridMath : HybridMathSpec {
      func add(a: Double, b: Double) throws -> Double {
        if a < 0 || b < 0 {
          throw RuntimeError.error(withMessage: "Value cannot be negative!")
        }
        return a + b
      }
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMath.kt"
    class HybridMath : HybridMathSpec() {
      override fun add(a: Double, b: Double): Double {
        if (a < 0 || b < 0) {
          throw Error("Value cannot be negative!")
        }
        return a + b
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp title="HybridMath.hpp"
    class HybridMath: public HybridMathSpec {
      double add(double a, double b) override {
        if (a < 0 || b < 0) {
          throw std::runtime_error("Value cannot be negative!");
        }
        return a + b;
      }
    };
    ```
  </TabItem>
</Tabs>

Errors will be propagated upwards to JS and can be caught just like any other kind of error using `try`/`catch`:

```diff
// code-error
`Math.add(...)`: Value cannot be negative!
```

### Promise rejections

Promises can also be rejected using error throwing syntax on the native side:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMath.swift"
    class HybridMath : HybridMathSpec {
      func add(a: Double, b: Double) throws -> Promise<Double> {
        return Promise.async {
          if a < 0 || b < 0 {
            throw RuntimeError.error(withMessage: "Value cannot be negative!")
          }
          return a + b
        }
      }
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMath.kt"
    class HybridMath : HybridMathSpec() {
      override fun add(a: Double, b: Double): Promise<Double> {
        return Promise.async {
          if (a < 0 || b < 0) {
            throw Error("Value cannot be negative!")
          }
          return@async a + b
        }
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp title="HybridMath.hpp"
    class HybridMath: public HybridMathSpec {
      std::shared_ptr<Promise<double>> add(double a, double b) override {
        return Promise<double>::async([=]() -> double {
          if (a < 0 || b < 0) {
            throw std::runtime_error("Value cannot be negative!");
          }
          return a + b;
        });
      }
    };
    ```
  </TabItem>
</Tabs>

Promise rejections are handled as usual using the `.catch`, or `await`/`catch` syntax in JS:

```ts
const math = // ...
try {
  await math.add(-5, -1)
} catch (error) {
  console.log(error)
}
```
