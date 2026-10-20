---
description: Learn how Nitro Hybrid Objects expose native C++, Swift, and Kotlin implementations to JavaScript with methods, properties, and type-safe bindings.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Hybrid Objects

A **Hybrid Object** is a native object that can also be used from JS.
Similar to a JavaScript `class`, **Hybrid Objects** can have instance methods, properties (get + set), static methods and properties, constructors (`new`) and inheritance chains via prototypes.

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Math.nitro.ts"
@iOS(...)
@Android(...)
export declare class Math extends HybridObject {
  static readonly pi: number
  static add(a: number, b: number): number
}
export * from '#nitro/Math'
```

</div>
<div className="side-by-side-block">

```swift title="HybridMath.swift"
class HybridMath : HybridMathSpec {
  static let pi = Double.pi
  static func add(a: Double, b: Double) -> Double {
    return a + b
  }
}
```

</div>
</div>

## Working with Hybrid Objects

If a Hybrid Object has static methods, those can be called directly on the class:

```ts
import { Math } from './Math.nitro'

const result = Math.add(5, 7)
```

Similarly, if a Hybrid Object has a `constructor(...)`, instances of the Hybrid Object can be created via `new`:

```ts
import { Math } from './Math.nitro'

const math = new Math(...)
```

A Hybrid Object can also create other Hybrid Objects:

```ts title="Image.nitro.ts"
@iOS(...)
@Android(...)
export declare class Image extends HybridObject {
  readonly width: number
  readonly height: number
  saveToFile(path: string): Promise<void>
}
export * from '#nitro/Image'

@iOS(...)
@Android(...)
export declare class ImageLoader extends HybridObject {
  static loadImageFromWeb(path: string): Promise<Image>
  static loadImageFromFile(path: string): Image
  static loadImageFromResources(name: string): Image
}
export * from '#nitro/ImageLoader'
```

## Base Methods

Every Hybrid Object has base methods and properties, like `toString()` and `equals(..)`:

```ts
const math = new Math()
const anotherMath = math

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
Keep shared instances alive while other code still uses them. Static methods belong to the class and do not require an instance to dispose.

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
  @iOS({
    language: 'swift',
    implementation: { className: 'HybridMath' }
  })
  @Android({
    language: 'kotlin',
    implementation: { className: 'HybridMath' }
  })
  export declare class Math extends HybridObject {
    static add(a: number, b: number): number
  }
  ```

  Running [nitrogen](nitrogen) generates `HybridMathSpec`, a protocol/base-class composition in Swift and an abstract class in Kotlin. Extend it in your implementation:

  <Tabs groupId="native-language">
    <TabItem value="swift" label="Swift" default>
      ```swift title="HybridMath.swift"
      class HybridMath : HybridMathSpec {
        static func add(a: Double, b: Double) throws -> Double {
          return a + b
        }
      }
      ```
    </TabItem>
    <TabItem value="kotlin" label="Kotlin">
      ```kotlin title="HybridMath.kt"
      class HybridMath : HybridMathSpec() {
        companion object {
          fun add(a: Double, b: Double): Double {
            return a + b
          }
        }
      }
      ```
    </TabItem>
  </Tabs>

  For more information, see the [Nitrogen documentation](nitrogen).

  </TabItem>
  <TabItem value="manually" label="Manually">

  To implement a Hybrid Object without nitrogen, you just need to create a C++ class that inherits from the [`HybridObject`](https://github.com/margelo/nitro/blob/v1/packages/nitro-core/native/cpp/include/NitroModules/HybridObject.hpp) base class, and implements its `Class`:

  <div className="side-by-side-container">
    <div className="side-by-side-block">
      ```cpp title="HybridMath.hpp"
      class HybridMath: public HybridObject {
      public:
        struct Class {
          using Base = HybridObject::Class;
          static constexpr const char* name = "Math";
          static const std::shared_ptr<const HybridClass>& get();
        };

        const std::shared_ptr<const HybridClass>& getHybridClass() override {
          return Class::get();
        }

        static double add(double a, double b);
      };
      ```
    </div>
    <div className="side-by-side-block">
      ```cpp title="HybridMath.cpp"
      const std::shared_ptr<const HybridClass>& HybridMath::Class::get() {
        static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
          clazz.registerStaticHybridMethod("add", &HybridMath::add);
        });
        return hybridClass;
      }

      double HybridMath::add(double a, double b) {
        return a + b;
      }
      ```
    </div>
  </div>

  Register the descriptor and expose it to JavaScript as shown in the [manual setup guide](../getting-started/how-to-build-a-nitro-module#2-create-hybrid-object-specs).
  </TabItem>
</Tabs>

## Inheritance

As the name suggests, Hybrid Objects are object-oriented, meaning they fully support inheritance and abstraction.
A Hybrid Object can either inherit from other Hybrid Objects, or satisfy a common interface.

<Tabs groupId="nitrogen-or-not">
  <TabItem value="nitrogen" label="With Nitrogen ✨" default>

  ### Inherit from other Hybrid Objects

  Each Hybrid Object has a proper JavaScript prototype chain, created automatically and lazily.
  When a Hybrid Object inherits from another Hybrid Object, it extends the prototype chain. Set `allowInheritance: true` and `allowMultipleImplementations: true` on the base spec's platform decorators:

  <div className="side-by-side-container">
    <div className="side-by-side-block" style={{ flex: 2 }}>
    <div>
    ```ts
    @iOS({
      // ...
      // highlight-next-line
      allowInheritance: true,
      // highlight-next-line
      allowMultipleImplementations: true
    })
    export declare class Media extends HybridObject {
      readonly width: number
      readonly height: number
      saveToFile(): Promise<void>
    }
    export * from '#nitro/Media'

    type ImageFormat = 'jpg' | 'png'
    @iOS(...)
    @Android(...)
    // highlight-next-line
    export declare class Image extends Media {
      constructor(bytes: ArrayBuffer)
      readonly format: ImageFormat
    }
    export * from '#nitro/Image'

    const image1 = new Image(FIRST_IMAGE_BYTES)
    const image2 = new Image(SECOND_IMAGE_BYTES)
    image2.saveToFile()
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

  Hybrid Objects can implement a common TypeScript interface. Declare the members on each class too, so Nitrogen generates their native bindings. The `implements` clause checks the TypeScript shape without adding a native base class:

  ```ts
  interface Media {
    readonly width: number
    readonly height: number
  }

  @iOS(...)
  @Android(...)
  // highlight-next-line
  export declare class Image extends HybridObject implements Media {
    readonly width: number
    readonly height: number
  }
  export * from '#nitro/Image'

  @iOS(...)
  @Android(...)
  // highlight-next-line
  export declare class Video extends HybridObject implements Media {
    readonly width: number
    readonly height: number
  }
  export * from '#nitro/Video'
  ```

  </TabItem>
  <TabItem value="manually" label="Manually">

  ### Inherit from other Hybrid Objects

  To inherit from another Hybrid Object in C++, define the inheritance via your `Class`'s `Base`:

  ```cpp title="HybridImage.hpp"
  class HybridImage: public HybridMedia {
  public:
    struct Class {
      // highlight-next-line
      using Base = HybridMedia::Class;
      static constexpr const char* name = "Image";
      static const std::shared_ptr<const HybridClass>& get();
    };

    const std::shared_ptr<const HybridClass>& getHybridClass() override {
      return Class::get();
    }

    // Image specific methods
    ImageFormat getFormat();
  };
  ```

  Then, simply register your own methods - `HybridClass` already extended `HybridMedia`'s prototype:

  ```cpp title="HybridImage.cpp"
  const std::shared_ptr<const HybridClass>& HybridImage::Class::get() {
    static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
      clazz.registerHybridMethod("getFormat", &HybridImage::getFormat);
    });
    return hybridClass;
  }
  ```

  ### Override base methods/properties

  In a C++ Hybrid Object, you can also override base methods and properties by just registering them again on the `HybridClass`:

  ```cpp title="HybridImage.cpp"
  const std::shared_ptr<const HybridClass>& HybridImage::Class::get() {
    static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
      clazz.registerHybridMethod("getMediaType", &HybridImage::getFormat);
    });
    return hybridClass;
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
  private let cgImage: CGImage

  init(cgImage: CGImage) {
    self.cgImage = cgImage
    super.init()
  }

  var memorySize: Int {
    return cgImage.bytesPerRow * cgImage.height
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
class HybridMath: public HybridObject {
public:
  struct Class {
    using Base = HybridObject::Class;
    static constexpr const char* name = "Math";
    static const std::shared_ptr<const HybridClass>& get() {
      static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
        // highlight-next-line
        clazz.registerRawHybridMethod("sayHello", 2, &HybridMath::sayHello);
      });
      return hybridClass;
    }
  };

  const std::shared_ptr<const HybridClass>& getHybridClass() override {
    return Class::get();
  }

  jsi::Value sayHello(jsi::Runtime& runtime,
                      const jsi::Value& thisValue,
                      const jsi::Value* args,
                      size_t count);
};
```
