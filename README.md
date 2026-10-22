<a href="https://nitro.margelo.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/static/img/banner-nitro-modules-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="./docs/static/img/banner-nitro-modules-light.png" />
    <img alt="Nitro Modules" src="./docs/static/img/banner-nitro-modules-light.png" />
  </picture>
</a>

<br />

**Nitro Modules** are fast, type-safe native modules for React Native with statically compiled bindings to JSI. This repository contains:

- [**nitro-core**](packages/nitro-core): Shared native runtime for C++, Swift and Kotlin, the JavaScript API, and TypeScript definitions
- [**nitrogen**](packages/nitrogen): Code generator for C++, Swift, and Kotlin bindings
- [**react-native-nitro-modules**](packages/react-native-nitro-modules): React Native installation, views, worklets, and native build
  integration

## Example

Declaration (TypeScript):

```ts
import { Apple, type HybridObject } from 'nitro-core'

@Apple({
  language: 'c++',
  implementation: { className: 'HybridMath', include: '"HybridMath.hpp"' },
})
export declare class Math extends HybridObject {
  constructor()
  add(a: number, b: number): number
}
export * from '#nitro/Math'
```

Implementation (C++, Swift or Kotlin):

```cpp
class HybridMath: public HybridMathSpec {
public:
  HybridMath() = default;
  double add(double a, double b) override {
    return a + b;
  }
};
```

Usage (TypeScript):

```ts
import { Math } from './Math.nitro'

const math = new Math()
const result = math.add(5, 3)
```

## Installation

Nitro V1 requires React Native 0.88 or newer with the New Architecture. Install the alpha package in your app:

```sh
npm i react-native-nitro-modules@alpha
```

For iOS, use Swift Package Manager and run `npx react-native spm` from the app directory. See the
[installation guide](./packages/react-native-nitro-modules/README.md#installation) for existing CocoaPods projects.

## Documentation

- [**Nitro** docs 📚](https://nitro.margelo.com)
- [**Community Discord** 💬](https://margelo.com/discord)
- [**Nitro Module Builder** AI GPT 🤖](https://chatgpt.com/g/g-6870125d0fcc8191925bd20a02c78bcf-nitro-module-builder)
- [**How to build a Nitro Module** YouTube Tutorial ▶️](https://youtu.be/528SxTGnIlc?si=IxH7n09ZVe4iwRPv)
- [**nitrogen**/README.md](./packages/nitrogen/README.md)
- [**react-native-nitro-modules**/README.md](./packages/react-native-nitro-modules/README.md)
- [**react-native-nitro-test** example module](./tests/react-native/packages/react-native-nitro-test/README.md)
- [`TestObject.nitro.ts` HybridObject test specs](./tests/standalone/nitro-test/specs/TestObject.nitro.ts)

## Supported Platforms

### Cross-platform

Cross-platform native modules can be built with C++. Any custom C++ types can be used and bridged to JS with minimal overhead.

JS <-> C++ type converters are statically generated ahead of time - no more dynamic lookups or runtime parser errors! 🥳

### Apple

Native modules and view components for Apple platforms can be written either in pure C++, or pure Swift. Thanks to Swift 5.9, Swift Nitro
Modules [bridge directly to C++](https://www.swift.org/documentation/cxx-interop/) instead of going through Objective-C message sends.
Woohoo, no more Objective-C, and **zero overhead** C++ -> Swift calls! 🥳

### Android

Android native modules and view components can be written either in pure C++, or pure Kotlin/Java. Thanks to fbjni, even complex types can
be effortlessly bridged to Kotlin/Java with minimal overhead! 🔥

## Margelo

Nitro is built with ❤️ by Margelo. We build fast and beautiful apps. Contact us at [margelo.com](https://margelo.com) for consultancy
services.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the contribution flow (PR expectations, the required test-per-fix rule, and the nitrogen
workflow). For environment setup and reproduction walkthroughs, see the
[contributing guide](https://nitro.margelo.com/docs/resources/contributing) on the docs site.

## License

MIT
