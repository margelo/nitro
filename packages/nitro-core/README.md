# nitro-core

Nitro's shared runtime sources and JavaScript API.

The package contains native sources in `native/{cpp,apple,android}/`, TypeScript
sources in `js/src/`, and compiled JavaScript and declarations in `js/lib/`.
Native sources and JS use the same package version. Core has no React Native
dependency. Views, TurboModules, and React Native dispatchers live in
`react-native-nitro-modules`, which stages Core sources for CocoaPods and Android
builds.

```ts
import type { HybridObject } from 'nitro-core'

export interface Image extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
  readonly width: number
  readonly height: number
}
```

The package includes `HybridObject`, platform and custom type definitions,
`NitroModulesProxy`, and helpers such as `getHybridObjectConstructor`.
Nitrogen reads these definitions when generating native bindings.

Importing the package does not install Nitro or require a native runtime.
The host integration installs the native proxy and dispatcher, checks its
version, then calls `getNitroModules()` to initialize the exported
`NitroModules` binding. The binding is the native object itself.
Call `getInstalledNitro()` to check whether the current runtime has a proxy.

Each loaded module instance has its own `NitroModules` binding. Code loaded
independently, including a separate CommonJS or ESM copy, should call
`getNitroModules()` to initialize its binding and access the runtime's native
proxy.

React Native applications should initialize Nitro through
`react-native-nitro-modules`, which re-exports these APIs and handles native
installation and worklets support:

```ts
import { NitroModules, type HybridObject } from 'react-native-nitro-modules'
```

Keep `nitro-core`, Nitrogen, and the host integration on the same release version.
The host integration package supplies platform build integration and stages the
native sources from its exact `nitro-core` dependency. Staged files are generated;
Core implementation changes belong in this package. React Native adapter changes
belong in `react-native-nitro-modules`.

The React Native entry resolves to compiled JavaScript. After editing this
package, run `bun run build` before rebuilding an app. Validate native changes
in both `tests/standalone` and `tests/react-native` in this repository.
