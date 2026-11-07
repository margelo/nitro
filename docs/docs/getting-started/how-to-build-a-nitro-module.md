---
description:
  Build a React Native Nitro Module from scratch with TypeScript specs, Nitrogen code generation, C++, Swift or Kotlin implementations, and
  package setup.
toc_min_heading_level: 2
toc_max_heading_level: 2
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# How to build a Nitro Module

A [Nitro Module](../concepts/nitro-modules) is essentially just a react-native library that depends on react-native-nitro-modules and
exposes one or more [Hybrid Objects](../concepts/hybrid-objects). It can either just use react-native-nitro-modules directly from C++, or
use [Nitrogen](../concepts/nitrogen) to generate bindings from TypeScript to native - in this case you can even use Swift and Kotlin.

This is a quick guide to build a Nitro Module from start to finish:

## 1. Create a Nitro Module

First, you need to create a [Nitro Module](../concepts/nitro-modules) - either by bootstrapping a template using
[nitrogen](../concepts/nitrogen), [react-native-builder-bob](https://github.com/callstack/react-native-builder-bob) or
[create-nitro-module](https://github.com/patrickkabwe/create-nitro-module) - or by manually adding Nitro to your existing library/app.

<Tabs groupId="template-bootstrap-cli">
  <TabItem value="nitrogen" label="nitrogen" default>
    ```sh
    npx nitrogen@latest init <name>
    ```

  </TabItem>
  <TabItem value="bob" label="react-native-builder-bob">
    ```sh
    npx create-react-native-library@latest
    ```

  </TabItem>
  <TabItem value="create-nitro-module" label="create-nitro-module">
    ```sh
    npx create-nitro-module@latest
    ```

  </TabItem>
  <TabItem value="manually" label="Manually">

    ### 1.1. Install Nitro and Nitrogen

    In your existing react-native library, install Nitro's core, React Native integration, and Nitrogen as dev dependencies:
    ```sh
    npm install nitro-core react-native-nitro-modules --save-dev
    npm install nitrogen --save-dev
    ```

    Keep these packages on the same Nitro release version. Also declare `nitro-core` and `react-native-nitro-modules` as **optional peer dependencies**, so the app using your library is the one that decides which Nitro version gets installed:

    ```json title="package.json"
    {
      "peerDependencies": {
        "nitro-core": "*",
        "react-native-nitro-modules": "*"
      },
      "peerDependenciesMeta": {
        "nitro-core": {
          "optional": true
        },
        "react-native-nitro-modules": {
          "optional": true
        }
      }
    }
    ```

    :::warning

    The `optional` flag matters. Without it, package managers try to satisfy the peer range themselves - and since semver ranges never match pre-releases, `"*"` does **not** match a version like `0.37.0-beta.0`. A user testing a Nitro beta would then get a second, stable copy of `react-native-nitro-modules` installed next to yours, and Nitro throws [`Nitro was installed twice`](../guides/troubleshooting#nitro-was-installed-twice) at runtime. Marking the peer optional stops the package manager from installing Nitro on your behalf.

    :::

    Then, you need to decide if you want to use Nitro's C++ library directly, or use [nitrogen](../concepts/nitrogen) to generate specs:

    <Tabs>
      <TabItem value="with-nitrogen" label="I will use Nitrogen later on" default>

        ### 1.2. Create a `nitro.json` file

        Next, create a `nitro.json` file. See [Configuration (`nitro.json`)](configuration-nitro-json) for a full guide.

        ### 1.3. Configure generated imports and native sources

        Follow [Nitrogen's build setup](../concepts/nitrogen#3-add-generated-sources-to-your-library) to add the `#nitro/*` package imports mapping and configure Swift Package Manager with `addNitrogenTargets(to:)`. Include the generated files in your npm package.

        Write your specs in step 2 before running Nitrogen. The generator requires at least one Hybrid Object spec.

      </TabItem>
      <TabItem value="without-nitrogen-at-all" label="I will not use Nitrogen">

        If you don't plan on using Nitrogen at all - and instead write your [Hybrid Objects](../concepts/hybrid-objects) manually using C++, you do not need to set up any autolinking files since you will be responsible for exposing your Hybrid Objects to JS.

      </TabItem>

    </Tabs>

  </TabItem>

</Tabs>

## 2. Create Hybrid Object specs

To actually use Nitro, you need to create [Hybrid Objects](../concepts/hybrid-objects) - either by using Nitro's code-generator CLI
“[Nitrogen](../concepts/nitrogen)”, or by just manually extending the `HybridObject` base class in C++.

<Tabs groupId="nitrogen-or-not">
  <TabItem value="nitrogen" label="With Nitrogen ✨" default>

    ### 2.1. Write the HybridObject specs

    A spec is just a `*.nitro.ts` file that exports two things:
    1. A **class declaration** which extends `HybridObject` and describes its implementation via the [`@Apple` or `@Android` decorators](../concepts/platform-decorators)
    2. The generated JS class bindings via `#nitro/...`

    <Tabs groupId="native-language">
      <TabItem value="swift-kotlin" label="Swift/Kotlin" default>
      ```ts title="Math.nitro.ts"
      import { Apple, Android, type HybridObject } from 'nitro-core'

      @Apple({ language: 'swift', allowMultipleImplementations: true })
      @Android({ language: 'kotlin', allowMultipleImplementations: true })
      export declare class Math extends HybridObject {
        // ...
      }
      export * from '#nitro/Math'
      ```

      </TabItem>
      <TabItem value="cpp" label="C++">
      ```ts title="Math.nitro.ts"
      import { Apple, Android, type HybridObject } from 'nitro-core'

      @Apple({ language: 'c++', allowMultipleImplementations: true })
      @Android({ language: 'c++', allowMultipleImplementations: true })
      export declare class Math extends HybridObject {
        // ...
      }
      export * from '#nitro/Math'
      ```

      </TabItem>

    </Tabs>

    Right now `Math` is a class that doesn't have a native implementation yet.
    It cannot be constructed (`new Math(..)`), nor are there any static methods that are accessible on it.

    For `Math` it makes sense to have an `add(...)` method that can add two numbers together - it won't make sense to create instances of `Math` via `new Math(...)`, so we make `add(...)` a **static method**.

    For this, we need to connect an `implementation` via the `@Apple`/`@Android` decorators - this connects the JS class with the native implementation in Swift/Kotlin or C++:

    <Tabs groupId="native-language">
      <TabItem value="swift-kotlin" label="Swift/Kotlin" default>
      ```ts title="Math.nitro.ts"
      import { Apple, Android, type HybridObject } from 'nitro-core'

      @Apple({
        language: 'swift',
        // diff-add
        implementation: { className: 'HybridMath' }
      })
      @Android({
        language: 'kotlin',
        // diff-add
        implementation: { className: 'HybridMath' }
      })
      export declare class Math extends HybridObject {
        // diff-add
        static add(a: number, b: number): number
      }
      export * from '#nitro/Math'
      ```

      </TabItem>
      <TabItem value="cpp" label="C++">
      ```ts title="Math.nitro.ts"
      import { Apple, Android, type HybridObject } from 'nitro-core'

      @Apple({
        language: 'c++',
        // diff-add
        implementation: { className: 'HybridMath', include: '"HybridMath.hpp"' }
      })
      @Android({
        language: 'c++',
        // diff-add
        implementation: { className: 'HybridMath', include: '"HybridMath.hpp"' }
      })
      export declare class Math extends HybridObject {
        // diff-add
        static add(a: number, b: number): number
      }
      export * from '#nitro/Math'
      ```

      </TabItem>

    </Tabs>

    ### 2.2. Run nitrogen

    After writing specs, re-generate the generated code by running [nitrogen](../concepts/nitrogen):

    ```sh
    npx nitrogen
    ```

    This then will generate a native specs which you can implement - in C++, that'd be `HybridMathSpec.hpp`.

    ### 2.3. Implement the generated native specs

    <Tabs groupId="native-language">
      <TabItem value="swift-kotlin" label="Swift/Kotlin" default>

        <div className="side-by-side-container">
          <div className="side-by-side-block">
            Create a new file (e.g. `apple/HybridMath.swift`), and implement the `HybridMathSpec` protocol:

            ```swift title="HybridMath.swift"
            import Foundation
            import NitroModules

            class HybridMath : HybridMathSpec {
              static func add(a: Double,
                              b: Double) -> Double {
                return a + b
              }
            }
            ```
          </div>
          <div className="side-by-side-block">
            Create a new file (e.g. `android/.../HybridMath.kt`), and implement the `HybridMathSpec` interface:

            ```kotlin title="HybridMath.kt"
            package com.margelo.nitro.math

            class HybridMath : HybridMathSpec() {
              companion object : HybridMathSpec.Companion {
                override fun add(a: Double, b: Double): Double {
                  return a + b
                }
              }
            }
            ```
          </div>
        </div>

      </TabItem>
      <TabItem value="cpp" label="C++">
        Create a new header and implementation file (e.g. `cpp/HybridMath.hpp` and `cpp/HybridMath.cpp`), and implement the virtual `HybridMathSpec` class:

        <div className="side-by-side-container">
          <div className="side-by-side-block">
            ```cpp title="HybridMath.hpp"
            #include <NitroMath/HybridMathSpec.hpp>

            namespace margelo::nitro::math {
              class HybridMath: public HybridMathSpec {
              public:
                static double add(double a, double b);
              };
            }
            ```
          </div>
          <div className="side-by-side-block">
            ```cpp title="HybridMath.cpp"
            #include "HybridMath.hpp"

            namespace margelo::nitro::math {
              double HybridMath::add(double a,
                                     double b) {
                return a + b;
              }
            }
            ```
          </div>
        </div>

      </TabItem>

    </Tabs>

    Your class' name has to match the string passed to `implementation: ...` - here; `HybridMath`.

  </TabItem>
  <TabItem value="manually" label="Manually">

    To create new [Hybrid Objects](../concepts/hybrid-objects) manually, you simply create a new C++ class that meets the following requirements:

    1. It **public**-inherits from `HybridObject`
    2. It has a nested `Class` struct describing its JS prototype
    3. It overrides `getHybridClass()` to return that descriptor

    ```cpp title="HybridMath.hpp"
    #pragma once
    #include <NitroModules/HybridObject.hpp>

    namespace margelo::nitro::math {
      // diff-add
      // 1. Public-inherit from HybridObject
      class HybridMath : public HybridObject {
      public:
        // diff-add
        // 2. Register the `Class`
        struct Class {
          using Base = HybridObject::Class;
          static constexpr const char* name = "Math";
          static const std::shared_ptr<const HybridClass>& get() {
            static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
              clazz.registerStaticHybridMethod("add", &HybridMath::add);
            });
            return hybridClass;
          }
        };

        const std::shared_ptr<const HybridClass>& getHybridClass() override {
          return Class::get();
        }

        // diff-add
        // 3. Implement your method (`add(...)`)
        static double add(double a, double b) {
          return a + b;
        }
      };
    }
    ```

    Register the descriptor once in your library's native initialization code, before JavaScript uses it:

    ```cpp
    #include <NitroModules/HybridClassRegistry.hpp>

    margelo::nitro::HybridClassRegistry::registerHybridClass(
      "math.Math", margelo::nitro::math::HybridMath::Class::get());
    ```

    Then expose a typed class from `Math.ts`:

    ```ts title="Math.ts"
    import { NitroModules, type HybridObject } from 'react-native-nitro-modules'

    declare class Math extends HybridObject {
      private constructor()
      static add(a: number, b: number): number
    }

    const NativeMath: typeof Math = NitroModules.getHybridClass('math.Math')
    export { NativeMath as Math }
    ```

  </TabItem>

</Tabs>

## 3. Use your Hybrid Objects in JS

Finally, you can use the your Hybrid Object from JS. To call our static `add(...)` method, simply use `Math.add(...)`:

```ts
import { Math } from './Math.nitro'

const result = Math.add(5, 7) // --> 12
```

## 4. Run it

To test the library you just created, you now need to set up an example app for it.

<Tabs groupId="template-bootstrap-cli">
  <TabItem value="nitrogen" label="nitrogen" default>

    Nitro's template does not include an example app by default, which makes it easier to be used in monorepos.
    To create an example app yourself - for example with [Expo](https://expo.dev) - run `create-expo-app`:

    ```sh
    npx create-expo-app@latest
    ```

    Then, install the library in the example app - e.g. via:

    ```
    cd example
    npm install ../
    ```

  </TabItem>
  <TabItem value="bob" label="react-native-builder-bob">
    The [Builder Bob](https://github.com/callstack/react-native-builder-bob) template already includes an example app.
    Simply run the react-native app inside the `example/` folder.

  </TabItem>
  <TabItem value="create-nitro-module" label="create-nitro-module">
    The [create-nitro-module](https://github.com/patrickkabwe/create-nitro-module) template already includes an example app.
    Simply run the react-native app inside the `example/` folder.

  </TabItem>

</Tabs>

## 5. Dive deeper

Hybrid Objects can be instances with constructors, properties and instance methods - add a `constructor()` to be able to create instances of
`Math`:

```ts title="Math.nitro.ts"
import { Apple, Android, type HybridObject } from 'nitro-core'

// diff-add-start
export interface MathOptions {
  decimalPlaces: number
}
// diff-add-end

@Apple(...)
@Android(...)
export declare class Math extends HybridObject {
  // diff-add
  constructor(options: MathOptions)
  // diff-add
  add(a: number, b: number): number
}
export * from '#nitro/Math'
```

Then, simply create instances via `new Math(...)`:

```ts
import { Math } from './Math.nitro'

const math = new Math({ decimalPlaces: 2 })
math.add(1.234, 2.345) // --> 3.58

const preciseMath = new Math({ decimalPlaces: 4 })
preciseMath.add(1.234, 2.345) // --> 3.579
```
