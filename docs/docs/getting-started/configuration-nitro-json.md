---
title: Configuration (nitro.json)
description:
  Configure nitro.json for a React Native Nitro Module, including C++ namespace, Apple module name, Android package, and code generation
  paths.
---

# Configuration (`nitro.json`)

[Nitrogen](../concepts/nitrogen) requires a `nitro.json` file to be configured at the root of each
[Nitro Module](../concepts/nitro-modules).

```json
{
  "$schema": "https://nitro.margelo.com/nitro.schema.json",
  "environment": "react-native",
  "cxxNamespace": ["$$cxxNamespace$$"],
  "apple": {
    "appleModuleName": "$$appleModuleName$$"
  },
  "android": {
    "androidNamespace": ["$$androidNamespace$$"],
    "androidCxxLibName": "$$androidCxxLibName$$"
  },
  "ignorePaths": ["**/node_modules"]
}
```

Nitrogen parses this file with Zod, see
[`NitroUserConfig.ts`](https://github.com/margelo/nitro/blob/v1/packages/nitrogen/src/config/NitroUserConfig.ts) for more information.

## `environment`

Selects the package that generated JavaScript code imports Nitro APIs from:

- `"react-native"` (default): imports from `react-native-nitro-modules`, which installs Nitro in the React Native runtime.
- `"bare"`: imports from `nitro-core` for standalone runtimes.

This setting only changes the JavaScript imports. Native code generation is the same for both environments.

## `cxxNamespace`

The `cxxNamespace` is the C++ namespace that all C++ specs will be generated in. It is always relative to `margelo::nitro`, and can also
have multiple sub-namespaces:

<div className="side-by-side-container">
  <div className="side-by-side-block">
  ```json
  {
    "cxxNamespace": ["math", "extra"]
  }
  ```
  </div>
  <div className="side-by-side-block">
  ```cpp
  namespace margelo::nitro::math::extra {
    // ...generated classes
  }
  ```
  </div>
</div>

## `apple`

Settings for the Apple platforms: iOS, macOS, tvOS and visionOS.

### `appleModuleName`

The `appleModuleName` names the generated Swift module and SwiftPM library product. Use the same name in your library's `swiftpmConfig`:

<div className="side-by-side-container">
  <div className="side-by-side-block">
  ```json
  {
    "apple": {
      "appleModuleName": "NitroMath"
    }
  }
  ```
  </div>
  <div className="side-by-side-block">
  ```json title="package.json"
  {
    "swiftpmConfig": {
      "name": "NitroMath",
      "dependencies": ["react-native-nitro-modules"]
    }
  }
  ```
  </div>
</div>

See [Nitrogen's build setup](../concepts/nitrogen#3-add-generated-sources-to-your-library) for `Package.swift` and generated source
configuration.

## `android`

Settings specifically for the Android platform.

### `androidNamespace`

The `androidNamespace` represents the package namespace in which all Java/Kotlin files are generated and written in. Similar to the
`cxxNamespace`, this is always relative to `com.margelo.nitro`, and can also have multiple sub-namespaces.

In most cases, you should keep this in sync with the `namespace` specified in your `build.gradle`.

<div className="side-by-side-container">
  <div className="side-by-side-block">
  ```json
  {
    "android": {
      "androidNamespace": ["math", "extra"]
    }
  }
  ```
  </div>
  <div className="side-by-side-block">
  ```kotlin
  package com.margelo.nitro.math.extra

// ...

````
</div>
</div>

### `androidCxxLibName`

The `androidCxxLibName` represents the name of the native C++ library that JNI will load to connect Java/Kotlin to C++.

When this Nitro Module is using CMake, this is the same thing as the library defined in `CMakeLists.txt`.
Nitro will load this library at runtime using `System.loadLibrary`.

<div className="side-by-side-container">
<div className="side-by-side-block">
```json
{
  "android": {
    "androidCxxLibName": "NitroMath"
  }
}
````

  </div>
  <div className="side-by-side-block">
  ```cmake
  project(NitroMath)
  add_library(NitroMath SHARED
          src/main/cpp/cpp-adapter.cpp
          ../cpp/HybridMath.cpp
  )
  ```
  </div>
</div>

## `ignorePaths`

Configures the TypeScript parser to ignore specific given paths when looking for `*.nitro.ts` specs.

By default, this is empty (`[]`), but it can be set to ignore paths like `["node_modules", "lib"]`.
