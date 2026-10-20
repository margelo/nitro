# nitro-core

Nitro's shared runtime sources and JavaScript API.

The package contains native sources in `native/{cpp,apple,android}/`, TypeScript
sources in `js/src/`, and compiled JavaScript and declarations in `js/lib/`.
Native sources and JS use the same package version. Core has no React Native
dependency. Views, TurboModules, and React Native dispatchers live in
`react-native-nitro-modules`, which stages Core sources for SwiftPM and Android
builds.

```ts
import { HybridObject, iOS, Android } from 'nitro-core'

@iOS({ language: 'swift', allowMultipleImplementations: true })
@Android({ language: 'kotlin', allowMultipleImplementations: true })
export declare class Image extends HybridObject {
  readonly width: number
  readonly height: number
}
```

Nitrogen reads the declared classes and decorators to generate native bindings.
The package also exports `NitroModules`, `NitroModulesProxy`, and shared types.

The host must install the native proxy and dispatcher before importing
`nitro-core`. The exported `NitroModules` constant is the installed native proxy.
Core compares its native version with the JavaScript package version on import
and warns if they differ. Separately loaded CommonJS and ESM copies read the same
installed proxy.

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
