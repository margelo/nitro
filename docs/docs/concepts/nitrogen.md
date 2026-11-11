---
description: Learn how Nitrogen generates C++, Swift, and Kotlin bindings from TypeScript specs for React Native Nitro Modules.
toc_max_heading_level: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Nitrogen

**Nitrogen** is Nitro's code-generator. It parses TypeScript code using an [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree) parser to generate native interfaces from TypeScript definitions.

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

```swift title="HybridMathSpec.swift (generated)"
protocol HybridMathSpec: HybridObject {
  var pi: Double { get }
  func add(a: Double, b: Double) -> Double
}
```

</div>
</div>

When `HybridMathSpec` is not implemented properly on the native side (e.g. if `add(..)` is missing, or if a type is incorrect), **the app will not compile**, which ensures full **type-safety** and **null-safety** at compile-time.

## Nitrogen is optional

Nitrogen is a fully optional CLI that does some of the work for you.
You can also build Nitro Modules and create Hybrid Objects without nitrogen, by just calling the `registerHybrids` method yourself.

## Who uses Nitrogen?

Nitrogen should be used by library-authors, and generated specs should be committed to the repository/package.

If you build an app that uses libraries built with Nitro, **you do not need to run nitrogen yourself**.

## Configuration

Nitrogen should be installed as a dev-dependency in the Nitro Module (library).

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```sh
    npm i nitrogen --save-dev
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```sh
    yarn add nitrogen -D
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```sh
    pnpm add nitrogen -D
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```sh
    bun i nitrogen -d
    ```
  </TabItem>
</Tabs>

Each Nitro Module needs to have a `nitro.json` configuration file.

Create a `nitro.json` file in the root directory of your Nitro Module (next to `package.json`), and add the following content:

```json title="nitro.json"
{
  "$schema": "https://nitro.margelo.com/nitro.schema.json",
  "cxxNamespace": ["math"],
  "ios": {
    "iosModuleName": "NitroMath"
  },
  "android": {
    "androidNamespace": ["math"],
    "androidCxxLibName": "NitroMath"
  },
  "autolinking": {}
}
```

Tweak your module name and namespaces as needed.

## Usage

Nitrogen parses all TypeScript files that end in `.nitro.ts`.

### 1. Write TypeScript specs

For example, let's create `Math.nitro.ts`:

```ts title="Math.nitro.ts"
import { type HybridObject } from 'react-native-nitro-modules'

interface Math extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
  add(a: number, b: number): number
}
```

### 2. Generate native specs

Now run nitrogen:

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```sh
    npx nitrogen
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```sh
    yarn nitrogen
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```sh
    pnpm nitrogen
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```sh
    bun nitrogen
    ```
  </TabItem>
</Tabs>

This will always generate a shared C++ interface, and then optionall also Swift and Kotlin sub-classes. The specs go into `./nitrogen/generated/`:

```
🔧  Loading nitro.json config...
🚀  Nitrogen runs at ~/Projects/nitro/example/dummy
    🔍  Nitrogen found 1 spec in ~/Projects/nitro/example/dummy
⏳  Parsing Math.nitro.ts...
    ⚙️  Generating specs for HybridObject "Math"...
        shared: Generating C++ code...
⛓️   Setting up build configs for autolinking...
🎉  Generated 1/1 HybridObject in 0.6s!
💡  Your code is in ./nitrogen/generated
‼️  Added 8 files - you need to run `pod install`/sync gradle to update files!
```

:::important
You should push the files in `./nitrogen/generated/` to git, and make sure those files are part of your npm package.
This way your library will always ship a working package as a whole (including generated interfaces), and the user does not need to do anything else than to install your package.
:::

Nitrogen always writes a `.gitattributes` file in the output directory with `** linguist-generated=true`. GitHub uses this to collapse generated files in diffs and exclude them from language statistics.

### 3. Add generated sources to your library

All the generated sources (`./nitrogen/generated/`) need to be part of your library's code - so we need to add it to the iOS/Android build files.

<Tabs>
  <TabItem value="template" label="With the Nitro template">

  If you created a library using the [Nitro Module template](https://github.com/margelo/nitro/tree/main/packages/template), your library already includes nitrogen's generated sources.

  </TabItem>
  <TabItem value="manually" label="Manually">

  #### iOS

  On iOS, you need to call `add_nitrogen_files(...)` from your library's `.podspec`. Put this at the very end of your spec declaration:
  ```ruby
  Pod::Spec.new do |s|
    # ...
    load 'nitrogen/generated/ios/NitroExample+autolinking.rb'
    add_nitrogen_files(s)
  end
  ```

  #### Android

  On Android, you first need to add the autogenerated Java/Kotlin sources to your `build.gradle`. Put this at the top of your `build.gradle`, right after any other `apply` calls:

  ```groovy
  apply from: '../nitrogen/generated/android/NitroExample+autolinking.gradle'
  ```

  Then, add the autogenerated C++ sources to your `CMakeLists.txt`. Put this somewhere **after** `add_library(...)`:

  ```cmake
  include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroExample+autolinking.cmake)
  ```

  :::tip
  Replace `NitroExample` with your Nitro Module's name as defined in your `nitro.json`.
  :::
  </TabItem>
</Tabs>

### 4. Implement the Hybrid Objects

To implement `Math` now, you just need to implement the spec:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMath.swift"
    class HybridMath : HybridMathSpec {
      func add(a: Double, b: Double) throws -> Double {
        return a + b
      }
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMath.kt"
    class HybridMath : HybridMathSpec() {
      override fun add(a: Double, b: Double): Double {
        return a + b
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    <div className="side-by-side-container">
      <div className="side-by-side-block">
        ```cpp title="HybridMath.hpp"
        class HybridMath: public HybridMathSpec {
        public:
          HybridMath(): HybridObject(TAG) {}
        public:
          double add(double a, double b) override;
        };
        ```
      </div>
      <div className="side-by-side-block">
        ```cpp title="HybridMath.cpp"
        double HybridMath::add(double a, double b) {
          return a + b;
        }
        ```
      </div>
    </div>
  </TabItem>
</Tabs>

### 5. Register the Hybrid Objects

Nitro needs to be able to initialize an instance of your Hybrid Object - so we need to tell it how to do that.
In your `nitro.json`, register `HybridMath` in the `"autolinking"` section:
<Tabs>
  <TabItem value="swift-kotlin" label="Swift/Kotlin" default>
    ```json
    {
      ...
      "autolinking": {
        "Math": {
          "ios": {
            "language": "swift",
            "implementationClassName": "HybridMath"
          },
          "android": {
            "language": "kotlin",
            "implementationClassName": "HybridMath"
          }
        }
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```json
    {
      ...
      "autolinking": {
        "Math": {
          "all": {
            "language": "c++",
            "implementationClassName": "HybridMath"
          }
        }
      }
    }
    ```
  </TabItem>
</Tabs>

Make sure `HybridMath` is default-constructible and scoped inside the correct namespace/package/file, **then run Nitrogen**.

#### 5.1. Initialize Android (C++)

<Tabs>
  <TabItem value="template" label="With the Nitro template">

  If you created a library using the [Nitro Module template](https://github.com/margelo/nitro/tree/main/packages/template), your library already initializes the C++ autolinking process from your `*Package.kt` and `OnLoad.cpp` files.

  </TabItem>
  <TabItem value="manually" label="Manually">

  In your JNI OnLoad function (`OnLoad.cpp` or `cpp-adapter.cpp`), initialize your module:

  ```cpp title="cpp-adapter.cpp"
  #include <jni.h>
  #include <fbjni/fbjni.h>
  #include "NitroMathOnLoad.hpp"

  JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    return facebook::jni::initialize(vm, []() {
      margelo::nitro::math::registerAllNatives();
    });
  }
  ```

  Then, to actually load and initialize the C++ part of your library (which calls `JNI_OnLoad` from above), call `initializeNative()` from your library's entry point (`*Package.kt`):

  ```kotlin title="NitroMathPackage.kt"
  public class NitroMathPackage: BaseReactPackage() {
    // ...
    companion object {
      init {
        NitroMathOnLoad.initializeNative();
      }
    }
  }
  ```

  </TabItem>
</Tabs>

#### 5.2. (Optional) ProGuard

If you are using ProGuard on Android, make sure to add a `@DoNotStrip` annotation above your `HybridMath` class (and constructor) so Nitro can construct it from C++ in release builds.

### 6. Initialize the Hybrid Objects

And finally, to initialize `HybridMath` from JS you just need to call `createHybridObject`:

```ts
export const MathModule = NitroModules.createHybridObject<Math>("Math")
const result = MathModule.add(5, 7)
```
