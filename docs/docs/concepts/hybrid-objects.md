---
description: Learn how Nitro Hybrid Objects expose native C++, Swift, and Kotlin implementations to JavaScript with methods, properties, and type-safe bindings.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Hybrid Objects

A **Hybrid Object** is a native object that can be used from JS like any other object.
They can have natively implemented methods, as well as properties (get + set).

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Math.nitro.ts"
interface Math
  extends HybridObject<{ ios: 'swift' }> {
  readonly pi: number
  add(a: number, b: number): number
}
```

</div>
<div className="side-by-side-block">

```swift title="HybridMath.swift"
class HybridMath : HybridMathSpec {
  var pi: Double {
    return Double.pi
  }
  func add(a: Double, b: Double) -> Double {
    return a + b
  }
}
```

</div>
</div>

## Working with Hybrid Objects

If a Hybrid Object is _autolinked_ (see ["**Nitrogen**: 5. Register the Hybrid Objects"](nitrogen#5-register-the-hybrid-objects)), it can be created from JS via `createHybridObject<T>(..)`:

```ts
const math = NitroModules.createHybridObject<Math>("Math")
const result = math.add(5, 7)
```

To enable the usage of `new` and `instanceof`, you can use the `getHybridObjectConstructor<T>(..)` helper method:

```ts
const HybridMath = getHybridObjectConstructor<Math>("Math")
const math = new HybridMath()
const isMath = math instanceof HybridMath
```

A Hybrid Object can also create other Hybrid Objects:

```ts title="Image.nitro.ts"
interface Image extends HybridObject<{ … }> {
  readonly width: number
  readonly height: number
  saveToFile(path: string): Promise<void>
}

interface ImageFactory extends HybridObject<{ … }> {
  loadImageFromWeb(path: string): Promise<Image>
  loadImageFromFile(path: string): Image
  loadImageFromResources(name: string): Image
}
```

## Base Methods

Every Hybrid Object has base methods and properties, like `name`, `toString()` and `equals(..)`:

```ts
const math = NitroModules.createHybridObject<Math>("Math")
const anotherMath = math

console.log(math.name) // "Math"
console.log(math.toString()) // "[HybridObject Math]"
console.log(math.equals(anotherMath)) // true
```

### Overriding base methods

In your implementation, you can override `HybridObject`'s base methods like `toString()` or `dispose()`:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMath.swift"
    class HybridMath : HybridMathSpec {
      func toString() -> String {
        return "{HybridMath}"
      }
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMath.kt"
    class HybridMath : HybridMathSpec() {
      override fun toString(): String {
        return "{HybridMath}"
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp title="HybridMath.hpp"
    class HybridMath: public HybridMathSpec {
      std::string toString() override {
        return "{HybridMath}";
      }
    };
    ```
  </TabItem>
</Tabs>

### `dispose()`

Additionally, every Hybrid Object has a `dispose()` method.
Usually, you should not need to manually dispose Hybrid Objects as the JS garbage collector will delete any unused objects anyways.
Also, most Hybrid Objects in Nitro are just statically exported singletons, in which case they should never be deleted throughout the app's lifetime.

In some rare, often performance-critical- cases it is beneficial to eagerly destroy any Hybrid Objects, which is why `dispose()` exists.
For example, [VisionCamera](https://github.com/margelo/react-native-vision-camera) uses `dispose()` to clean up already processed Frames to make room for new incoming Frames:

```ts
const onFrameListener = (frame: Frame) => {
  doSomeProcessing(frame)
  frame.dispose()
}
```

## Implementation

Hybrid Objects can be implemented in C++, Swift or Kotlin:

<Tabs groupId="nitrogen-or-not">
  <TabItem value="nitrogen" label="With Nitrogen ✨" default>

  Nitrogen will ✨ automagically ✨ generate native specifications for each Hybrid Object based on a given TypeScript definition:

  ```ts title="Math.nitro.ts"
  interface Math extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
    readonly pi: number
    add(a: number, b: number): number
  }
  ```

  Running [nitrogen](nitrogen) will generate the native Swift and Kotlin protocol "`HybridMathSpec`", that now just needs to be implemented in a class:

  <Tabs groupId="native-language">
    <TabItem value="swift" label="Swift" default>
      ```swift title="HybridMath.swift"
      class HybridMath : HybridMathSpec {
        var pi: Double {
          return Double.pi
        }
        func add(a: Double, b: Double) throws -> Double {
          return a + b
        }
      }
      ```
    </TabItem>
    <TabItem value="kotlin" label="Kotlin">
      ```kotlin title="HybridMath.kt"
      class HybridMath : HybridMathSpec() {
        override var pi: Double
          get() = Double.PI

        override fun add(a: Double, b: Double): Double {
          return a + b
        }
      }
      ```
    </TabItem>
  </Tabs>

  For more information, see the [Nitrogen documentation](nitrogen).

  </TabItem>
  <TabItem value="manually" label="Manually">

  To implement a Hybrid Object without nitrogen, you just need to create a C++ class that inherits from the [`HybridObject`](https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/cpp/core/HybridObject.hpp) base class, and override `loadHybridMethods()`:

  <div className="side-by-side-container">
    <div className="side-by-side-block">
      ```cpp title="HybridMath.hpp"
      class HybridMath: public HybridObject {
      public:
        HybridMath(): HybridObject(NAME) { }

      public:
        double add(double a, double b);

      protected:
        void loadHybridMethods() override;

      private:
        static constexpr auto NAME = "Math";
      };
      ```
    </div>
    <div className="side-by-side-block">
      ```cpp title="HybridMath.cpp"
      double HybridMath::add(double a, double b) {
        return a + b;
      }

      void HybridMath::loadHybridMethods() {
        // register base methods (toString, ...)
        HybridObject::loadHybridMethods();
        // register custom methods (add)
        registerHybrids(this, [](Prototype& proto) {
          proto.registerHybridMethod(
            "add",
            &HybridMath::add
          );
        });
      }
      ```
    </div>
  </div>

  A Hybrid Object should also override `getExternalMemorySize()` to properly reflect native memory size:

  ```cpp
  class HybridMath: public HybridObject {
  public:
    // ...
    size_t getExternalMemorySize() override {
      return sizeOfSomeImageWeAllocated;
    }
  }
  ```

  Optionally, you can also override `toString()` and `dispose()` for custom behaviour.

  </TabItem>
</Tabs>

## Inheritance

As the name suggests, Hybrid Objects are object-oriented, meaning they have full support for inheritance and abstraction.
A Hybrid Object can either inherit from other Hybrid Objects, or satisfy a common interface.

<Tabs groupId="nitrogen-or-not">
  <TabItem value="nitrogen" label="With Nitrogen ✨" default>

  ### Inherit from other Hybrid Objects

  Each Hybrid Object has a proper JavaScript prototype chain, created automatically and lazily.
  When a Hybrid Object inherits from another Hybrid Object, it extends the prototype chain:

  <div className="side-by-side-container">
    <div className="side-by-side-block" style={{ flex: 2 }}>
    <div>
    ```ts
    interface Media extends HybridObject<{ … }> {
      readonly width: number
      readonly height: number
      saveToFile(): Promise<void>
    }

    type ImageFormat = 'jpg' | 'png'
    interface Image extends HybridObject<{ … }>, Media {
      readonly format: ImageFormat
    }

    const image1 = NitroModules.createHybridObject<Image>('Image')
    const image2 = NitroModules.createHybridObject<Image>('Image')
    ```
    </div>
    </div>

    <div align="center" className="side-by-side-block">
    ```mermaid
    graph TD;
      HybridObject["HybridObject (4 props)"]-->HybridMediaSpec["Media (3 props)"]
      HybridMediaSpec-->HybridImageSpec["Image (1 prop)"]
      HybridImageSpec-->Image1["const image1"]
      HybridImageSpec-->Image2["const image2"]
    ```
    </div>
  </div>

  ### Inherit from a common interface

  With Nitrogen, you can define a common TypeScript interface that multiple Hybrid Objects inherit from.
  This non-HybridObject interface (`Media`) will not be a separate type on the native side, but all Hybrid Objects that extend from it will satisfy the TypeScript type:

  ```ts
  interface Media {
    readonly width: number
    readonly height: number
  }

  interface Image extends HybridObject<{ … }>, Media {}
  interface Video extends HybridObject<{ … }>, Media {}
  ```

  </TabItem>
  <TabItem value="manually" label="Manually">

  ### Inherit from other Hybrid Objects

  In C++, inheriting from a Hybrid Object is as simple as extending it, and adding the prototype in `loadHybridMethods()`:

  ```cpp title="HybridMath.hpp"
  class HybridImage: public HybridMedia {
  public:
    // Image specific methods
    ImageFormat getFormat();

    void loadHybridMethods() override {
      // register base prototype
      HybridMedia::loadHybridMethods();
      // register all methods we add here
      registerHybrids(this, [](Prototype& prototype) {
        prototype.registerHybridGetter("format", &HybridImage::getFormat);
      });
    }
  };
  ```

  ### Override base methods/properties

  In a C++ Hybrid Object, you can also override base methods and properties, even with different types:

  ```cpp title="HybridMath.hpp"
  class HybridImage: public HybridMedia {
  public:
    // Image specific methods
    std::string getSize();

    void loadHybridMethods() override {
      // register base protoype
      HybridMedia::loadHybridMethods();
      // HybridMedia already has .width, but it's a number.
      // We override it to be a string in HybridImage.
      registerHybrids(this, [](Prototype& prototype) {
        prototype.registerHybridGetter("width", &HybridImage::getSize);
      });
    }
  }
  ```

  The HybridImage's prototype's prototype (= HybridMedia's prototype) will still contain the original method/property.
  </TabItem>
</Tabs>

## Memory Size (`memorySize`)

Since a HybridObject's implementation is in native code, the JavaScript runtime does not know the actual memory size of a Hybrid Object.
Nitro allows Hybrid Objects to declare their memory size by overriding the `memorySize`/`getExternalMemorySize()` accessors, which can account for any external heap allocations you perform:

```swift
class HybridImage : HybridImageSpec {
  private var cgImage: CGImage
  var memorySize: Int {
    let imageSize = cgImage.width * cgImage.height * cgImage.bytesPerPixel
    return imageSize
  }
}
```

Any unused `Image` objects can now be deleted sooner by the JS garbage collector, preventing memory pressures or frequent garbage collector calls.

:::tip
It is safe to return `0` here, but recommended to somewhat closely estimate the actual size of native object if possible.
:::

### Raw JSI methods

If for some reason Nitro's typing system is not sufficient in your case, you can also create a raw JSI method using `registerRawHybridMethod(...)` to directly work with the `jsi::Runtime` and `jsi::Value` types:

```cpp title="HybridMath.hpp"
class HybridMath: HybridMathSpec {
public:
  jsi::Value sayHello(jsi::Runtime& runtime,
                      const jsi::Value& thisValue,
                      const jsi::Value* args,
                      size_t count);

  void loadHybridMethods() override {
    // register base protoype
    HybridMathSpec::loadHybridMethods();
    // register all methods we override here
    registerHybrids(this, [](Prototype& prototype) {
      prototype.registerRawHybridMethod("sayHello", 0, &HybridMath::sayHello);
    });
  }
}
```
