# $$packageName$$

This Nitro V1 starter includes an `Example` class and its Swift implementation. It requires React Native 0.88 or newer with the New Architecture, and Swift 6.4 or newer for iOS builds.

Install dependencies, then run `npm run specs` to generate native bindings and compile TypeScript. Nitrogen runs first because the spec re-exports its generated JavaScript class through `#nitro/Example`.

```ts
import { Example } from '$$packageName$$'

const example = new Example()
console.log(example.add(2, 3)) // 5
console.log(example instanceof Example) // true
```

The package pins Nitro and Nitrogen to the exact alpha version that created it. Keep those versions in sync when upgrading.

- `src/specs/Example.nitro.ts` declares the constructor, methods and Swift implementation through `@iOS`.
- `ios/HybridExample.swift` implements the generated `HybridExampleSpec`.
- `nitro.json` sets native module names and namespaces.
- `nitrogen/generated` contains native bindings and the lazy JavaScript class exports. Commit it and include it in the published package.
- `package.json` maps `#nitro/*` to the generated `.cjs` modules. Keep that mapping available to the compiled files as well as the source specs.

React Native's SwiftPM autolinking uses `Package.swift` and `swiftpmConfig` from `package.json`. Nitrogen adds targets for the Swift sources in `ios/`, C++ sources in `cpp/`, and generated bindings. The metadata-only podspec lets React Native CLI discover the iOS dependency.
