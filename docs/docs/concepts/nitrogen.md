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
@iOS(...)
@Android(...)
export declare class Math extends HybridObject {
  readonly pi: number
  add(a: number, b: number): number
}
export * from '#nitro/Math'
```

</div>
<div className="side-by-side-block">

```swift title="HybridMathSpec.swift (generated excerpt)"
public protocol HybridMathSpec_protocol: HybridObject {
  var pi: Double { get }
  func add(a: Double, b: Double) throws -> Double
}
```

</div>
</div>

When `HybridMathSpec` is not implemented properly on the native side (e.g. if `add(..)` is missing, or if a type is incorrect), **the app will not compile**, which ensures full **type-safety** and **null-safety** at compile-time.

## Nitrogen is optional

Nitrogen is a fully optional CLI that does some of the work for you.
You can also build Nitro Modules and create Hybrid Objects without nitrogen, by just registering the `HybridClass` yourself.

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
  }
}
```

## Usage

Nitrogen parses all TypeScript files that end in `.nitro.ts`.

### 1. Write TypeScript specs

A Nitro spec file consists of one or more `declare class` statements and combined `export`s.
- `declare class` describes your native class via instance methods, properties (get + set), `constructor(...)`, or static methods.
- The `@iOS` and `@Android` decorators on `declare class` describe the connection between the JS types and the native implementation - for example, `language: 'swift'` means that `Math` is implemented in Swift on iOS. `implementation: ...` defines the actual Swift class that implements the spec natively, which is required for it to have a `constructor()` or static methods.
- Since `declare class` is type-only, no JS runtime code exists. Nitrogen generates this, which must be re-exported via `export * from '#nitro/Math'`.

See [Platform decorators](platform-decorators) for all `@iOS` and `@Android` options, including multiple implementations, inheritance, and native protocol/interface requirements.

```ts title="Math.nitro.ts"
import { iOS, type HybridObject } from 'nitro-core'

@iOS({
  language: 'swift',
  implementation: { className: 'HybridMath' }
})
export declare class Math extends HybridObject {
  // Public constructor: new Math()
  constructor()
  // Static method: Math.add(5, 3)
  static add(a: number, b: number): number

  // Get-only instance property: math.pi
  readonly pi: number
  // Instance method: math.multiply(5, 3)
  multiply(a: number, b: number): number
}
export * from '#nitro/Math'
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

This generates the shared C++ specs, platform bindings, and JavaScript class exports in `./nitrogen/generated/`. Run Nitrogen before compiling TypeScript so the generated modules and their declarations exist:

```
🔧  Loading nitro.json config...
🚀  Nitrogen runs at ~/Projects/nitro/example/dummy
    🔍  Nitrogen found 1 spec in ~/Projects/nitro/example/dummy
⏳  Parsing Math.nitro.ts...
    ⚙️  Generating specs for HybridObject "Math"...
        shared: Generating C++ code...
🎉  Generated 1/1 HybridObject in 0.6s!
💡  Your code is in ./nitrogen/generated
‼️  Added 8 files - refresh SwiftPM (`npx react-native spm` for React Native) or sync Gradle to update files!
```

:::important
Commit `./nitrogen/generated/` and include it in your npm package, including the `.cjs` runtime modules and `.d.cts` declarations in `shared/javascript/`. If you use a `files` list in `package.json`, add `nitrogen/generated` to it. Consumers use these files without running Nitrogen themselves.
:::

### 3. Add generated sources to your library

All the generated sources (`./nitrogen/generated/`) need to be part of your library's code - so we need to add it to the iOS/Android build files.

<Tabs>
  <TabItem value="template" label="With the Nitro template">

  If you created a library using the [Nitro Module template](https://github.com/margelo/nitro/tree/v1/packages/template), your library already includes nitrogen's generated sources.

  </TabItem>
  <TabItem value="manually" label="Manually">

  #### JS imports/exports

  To resolve the `#nitro/*` alias, add an `imports` mapping to your library's `package.json`:

  ```json title="package.json"
  {
    "imports": {
      "#nitro/*": "./nitrogen/generated/shared/javascript/*.cjs"
    }
  }
  ```

  React Native's default `typescript-config` does not allow overridden `imports` in `package.json`, so enable it in your `tsconfig.json`:

  ```json title="tsconfig.json"
  {
    "extends": "@react-native/typescript-config",
    "compilerOptions": {
      "resolvePackageJsonImports": true
    }
  }
  ```

  #### iOS

  iOS builds use Swift Package Manager. Create a `Package.swift` next to your library's `nitro.json`:

  ```swift title="Package.swift"
  // swift-tools-version: 6.4

  import PackageDescription

  let package = Package(
    name: "NitroMath",
    platforms: [.iOS(.v16)]
  )

  addNitrogenTargets(to: package)
  ```

  Run `nitrogen` again after adding this file. Nitrogen appends the `addNitrogenTargets` helper between `// nitrogen:begin` and `// nitrogen:end`, and updates that section on subsequent runs. Keep your package declaration and helper call outside the generated section.

  The helper adds your Swift sources from `ios/`, C++ sources from `cpp/`, and the generated specs and bridges. It also configures Swift/C++ interoperability, C++20, and native dependencies. To use different source directories, pass paths relative to the package root:

  ```swift
  addNitrogenTargets(
    to: package,
    swiftSources: ["Sources/NitroMath"],
    cxxSources: ["native/cpp"]
  )
  ```

  Add `swiftpmConfig` to your library's `package.json` so React Native links the generated library product and its dependencies:

  ```json title="package.json"
  {
    "swiftpmConfig": {
      "name": "NitroMath",
      "dependencies": ["react-native-nitro-modules"]
    }
  }
  ```

  `name` must match `ios.iosModuleName` in `nitro.json`. Add the npm names of any other Nitro modules your library depends on to `dependencies`.

  Keep a `.podspec` with your library's metadata so React Native CLI can discover the iOS dependency, as in the [template podspec](https://github.com/margelo/nitro/blob/v1/packages/template/%24%24iosModuleName%24%24.podspec). Native sources and dependencies belong in `Package.swift`; remove the old `add_nitrogen_files(...)` call. Commit the updated manifest and include both `Package.swift` and the `.podspec` in your npm package.

  In the consuming React Native app, refresh SwiftPM after installing the library or changing its native sources:

  ```sh
  npx react-native spm
  ```

  For an existing CocoaPods app, first run `npx react-native spm add --deintegrate` from the app directory. See [Minimum Requirements](../getting-started/minimum-requirements) for the required React Native and Swift versions.

  </TabItem>
</Tabs>

### 4. Implement the Hybrid Objects

To implement `Math` now, you just need to implement the spec:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMath.swift"
    import NitroModules

    final class HybridMath : HybridMathSpec {
      static func add(a: Double, b: Double) throws -> Double {
        return a + b
      }

      var pi: Double { Double.pi }

      func multiply(a: Double, b: Double) throws -> Double {
        return a * b
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

      override val pi: Double = kotlin.math.PI

      override fun multiply(a: Double, b: Double): Double {
        return a * b
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp title="HybridMath.hpp"
    #include <NitroMath/HybridMathSpec.hpp>
    class HybridMath: public HybridMathSpec {
    public:
      HybridMath() = default;

      static double add(double a, double b) {
        return a + b;
      }

      double getPi() override { return 3.141592653589793; }

      double multiply(double a, double b) override {
        return a * b;
      }
    };
    ```
  </TabItem>
</Tabs>

### 5. Use the Hybrid Objects

Static methods are directly callable on the `Math` type:

```ts
import { Math } from './Math.nitro'

const result = Math.add(5, 7) // 12
```

Since `Math` has a `constructor()`, we can create instances of it with `new`:

```ts
import { Math } from './Math.nitro'

const math = new Math()
math.pi                       // 3.1415
math.multiply(5, 3)           // 15
```

Lastly, expose the class to consumers through your library's entry point:

```ts title="src/index.ts"
export { Math } from './specs/Math.nitro'
```
