<a href="https://nitro.margelo.com/docs/concepts/nitrogen">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../docs/static/img/banner-nitrogen-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="../../docs/static/img/banner-nitrogen-light.png" />
    <img alt="Nitrogen" src="../../docs/static/img/banner-nitrogen-light.png" />
  </picture>
</a>

<br />

Nitrogen generates C++ and Swift bindings from TypeScript class declarations using the [nitro-core](../nitro-core/) APIs.

## Installation

Install [nitrogen](https://npmjs.org/nitrogen) as a `devDependency` in your Nitro Module:

```sh
npm i nitrogen -D
```

Run it from the directory containing your `nitro.json`:

```sh
npx nitrogen
```

## Usage

Nitrogen fails if no specs are found or if a `.nitro.ts` file contains no HybridObjects. Files containing only helper types should use `.ts`
or `.d.ts`.

Declare and export a class in an `*.nitro.ts` file. The spec re-exports the class's runtime value from `#nitro/<ClassName>`, and Nitrogen
adds that line after the imports when it is missing:

```ts
// Image.nitro.ts
import { Apple, type HybridObject } from 'nitro-core'

export * from '#nitro/Image'

@Apple({
  language: 'swift',
  implementation: {
    className: 'HybridImage',
  },
})
export declare class Image extends HybridObject {
  public constructor(width: number, height: number)
  static square(size: number): Image
  readonly width: number
  readonly height: number
}
```

Class and member names must be ASCII. Nitro creates their JavaScript names with JSI's ASCII functions, so Nitrogen fails and names the line
of any other name.

Map `#nitro/*` to Nitrogen's JavaScript output in your `package.json`:

```json
"imports": {
  "#nitro/*": "./nitrogen/generated/shared/javascript/*.cjs"
}
```

Nitrogen reads this entry from the `package.json` closest to each spec before it generates anything. If the entry is missing or points
somewhere else, Nitrogen stops and prints what to change. A conditions object with a `default` also works if every condition points to that
path. A `types` condition can point to `./nitrogen/generated/shared/javascript/*.d.cts` instead.

Nitrogen warns if the `react-native-builder-bob` field in that `package.json` has a `commonjs` target or `esm: true` on the `module` target.
Bob then writes `package.json` files with a `type` field to its output, which hide the `imports` entry from the built specs. To avoid that,
build JavaScript with only the `module` target and set `esm: false` on it. Nitrogen only checks this field. It skips the check if a
`bob.config.mjs`, `bob.config.cjs` or `bob.config.js` file sits next to the `package.json`, because bob uses that file instead.

Run `npx nitrogen` after changing your specs and before building or publishing. Nitrogen writes a runtime module for each class to
`nitrogen/generated/shared/javascript/`, and `#nitro/Image` resolves to it. Import from `./Image.nitro` to get both the class and its
instance type.

TypeScript (with `moduleResolution` set to `bundler`, `node16` or `nodenext`), Metro 0.81.3 or newer and Rolldown resolve the `imports`
entry without aliases or custom resolvers. `@react-native/typescript-config` sets `resolvePackageJsonImports` to `false`. If your tsconfig
extends it, set `"resolvePackageJsonImports": true`. Otherwise TypeScript cannot find `#nitro/*` when it type-checks `.nitro.ts` specs, for
example in a monorepo or an example app that compiles your sources, or installed Nitro libraries with `skipLibCheck: false`.

If Babel compiles your specs, for example when Metro bundles your sources, it needs decorator syntax support. Install
`@babel/plugin-syntax-decorators@^7`, since version 8 requires `@babel/core` 8, and add
`['@babel/plugin-syntax-decorators', { version: '2023-11' }]` (or `version: 'legacy'`) to your plugins. `@babel/plugin-proposal-decorators`
works with `version: 'legacy'`, but crashes on decorated declared classes with `version: '2023-11'`. Apps also compile a library's specs
when its `react-native` or `source` field points at `src`. Point these fields at the built output to keep the specs out of the app's Babel.

Implement `HybridImage` in the same Swift module as the generated spec. C++ calls the generated `_cxx` Swift helper, which invokes
`HybridImage(width:height:)` for the constructor and `HybridImage.square(size:)` for the static method. Missing native types or signatures
produce compiler errors in the generated bridge.

The `implementation` object identifies the native type and, for C++ or Kotlin, its namespace or package:

| Language | Implementation                                                        |
| -------- | --------------------------------------------------------------------- |
| Swift    | `{ className: 'HybridImage' }`                                        |
| C++      | `{ include: '<MyImages/HybridImage.hpp>', className: 'HybridImage' }` |
| Kotlin   | `{ className: 'HybridImage' }`                                        |

C++ `namespace` and Kotlin `package` are optional arrays of segments within the declaring spec's own `nitro.json` project. Omit them or use
`[]` for that project's `cxxNamespace` or `android.namespace`. For a project configured with `['image']`, `['internal']` selects
`margelo::nitro::image::internal` or `com.margelo.nitro.image.internal`. Imported specs use their owning project's config. These options
cannot select a namespace or package outside that project, and `null` is invalid. The C++ `include` must contain angle brackets or double
quotes, for example `'<MyImages/HybridImage.hpp>'` or `'"HybridImage.hpp"'`. Nitrogen uses that header and the fully qualified C++ class
name; the header filename can differ from the class name.

Use `@Apple({ ... })` and `@Android({ ... })` to declare platform options. Decorators require TypeScript 5 or newer; standard decorators
work without `experimentalDecorators`. Nitrogen reads literal objects, arrays, strings, and booleans from the source. Variables, spreads and
computed values are unsupported. The imported helpers provide argument checking. The decorators are metadata for Nitrogen. They sit on
declared classes, which compile to no JavaScript, so they never run. If one does run, it throws. That happens when the spec uses `class`
instead of `declare class`, or when a transpiler emits decorator calls for declared classes, as swc does with decorators enabled. Compile
`.nitro.ts` specs with tsc, esbuild, oxc or Babel instead of swc, or use the library's built output. Write a class's JSDoc above its
decorators: editors don't show docs placed between a decorator and `export declare class` when hovering the class in the library's own
sources.

Public constructors, static methods and static properties require `implementation` on every declared platform. A spec can declare at most
one constructor. Declare a single public constructor to enable `new`; Nitrogen rejects constructor overloads during generation.

Static properties use `static readonly name: Type` for a getter or `static name: Type` for a getter and setter. Implement them as Swift
static properties, Kotlin companion properties, or C++ static `getName()` and `setName(value)` functions. Nitrogen registers their accessors
on the JavaScript constructor.

The `HybridObject` base constructor is protected. Omit the constructor, or declare it protected or private, for objects created by native
APIs. `implementation` alone does not enable JavaScript construction: Nitrogen only generates and registers a native constructor adapter for
an explicitly declared public constructor. Otherwise, native code must create instances and return them through another HybridObject API,
such as a method or a property. The class and prototype are still registered, so imports, `instanceof`, and declared static methods and
properties work. TypeScript rejects `new` for these classes, and calling their constructor from JavaScript throws that the class has no
public constructor.

Every platform decorator must choose exactly one of `implementation` or `allowMultipleImplementations: true`; they cannot be combined.
`implementation` selects the concrete Swift type stored by the bridge. Every Swift instance of that spec must be an instance of the selected
class. Use `allowMultipleImplementations: true` for a spec with several native implementations, such as an image backed by either UIImage or
CGImage; the Swift bridge stores the spec protocol existential.

A spec with `allowMultipleImplementations: true` has no public constructor, static methods or static properties. Create its instances in
native code and return them through another HybridObject API. A concrete factory can expose creation methods:

```ts
@Apple({
  language: 'swift',
  allowMultipleImplementations: true,
})
export declare class Image extends HybridObject {
  readonly width: number
  readonly height: number
}

@Apple({
  language: 'swift',
  implementation: { className: 'HybridImageFactory' },
})
export declare class ImageFactory extends HybridObject {
  static fromFile(path: string): Image
}
```

`allowInheritance` defaults to `false`. Set it to `true` to let another Nitrogen spec extend this spec on that platform. Specs with a
concrete `implementation` cannot enable inheritance; an inheritable base spec must use `allowMultipleImplementations: true`. Swift specs
with inheritance disabled get a final generated C++ wrapper. C++ specs remain inheritable by their native implementations; mark those
implementation classes final when appropriate.

## Native language boundaries

Each platform decorator selects the language of the generated native API. A Swift spec generates a Swift protocol and a private C++ bridge
with Swift signatures, such as `swift::String hello()`. It does not generate an abstract C++ spec with `std::string hello()`.
`allowMultipleImplementations` allows several implementations in the declared language.

A C++ spec can accept or return a Swift object:

```ts
@Apple({ language: 'swift', allowMultipleImplementations: true })
export declare class PlatformSpecific extends HybridObject {
  platformAPI(): string
}

@Apple({ language: 'c++', allowMultipleImplementations: true })
export declare class CrossPlatformObject extends HybridObject {
  doSomething(platform: PlatformSpecific): void
}
```

Nitrogen generates `HybridPlatformSpecificSpecCxx` because the C++ API references it. The C++ implementation receives a value handle:

```cpp
void doSomething(const HybridPlatformSpecificSpecCxx& platform) override {
  std::string result = platform.platformAPI();
}
```

The handle retains the existing Swift object and converts arguments and return values at the call. Returning it to JavaScript preserves the
original instance and prototype. A child handle can be copied as its base while retaining the child object. Public constructors become
`HybridPlatformSpecificSpecCxx::create(...)` factories; declared static methods remain static methods.

Adapters are generated only for objects reached through C++ APIs, including nested structs, containers, callbacks and promises. An adapter
for an external module belongs to the consuming module. Its class lives in the consumer's `adapters::<SourceModule>` namespace.

Swift structs and enums belong to the module declaring the native API. Importing a TypeScript value into a local Swift spec generates a
local Swift value. C++ adapters for an external Swift API convert to that API module's Swift values. Handwritten Swift calls between modules
may need an explicit conversion between their value types.

Structs and enums used by these C++ APIs must have distinct names within the consuming module. Nitrogen reports an error if values from
different source modules would generate the same C++ name.

Objects exposed through a C++ adapter cannot declare methods named `fromNative` or `getNativeObject`, or a `nativeObject` property: those
names conflict with adapter helpers. `create` is also reserved when the object has a public constructor. Nitrogen checks inherited members
and rejects conflicts before generating files.

Swift and Kotlin APIs can reference objects implemented in the same language on that platform. Nitrogen rejects other references, including
references inside nested types. A C++ object cannot currently be passed to a Swift API; use callbacks to expose the operations the Swift
object needs. The Kotlin-to-C++ adapter backend is not implemented yet.

## Importing classes

Import classes using the spec path without `.ts`. Each import provides both the instance type and the native constructor:

```ts
import { HybridObject } from 'nitro-core'
import { Image } from './Image.nitro'

const image: Image = new Image(640, 480)
const square = Image.square(128)
console.log(image instanceof Image) // true
console.log(image instanceof HybridObject) // true
```

Re-export the class from your package entry point. Consumers import it from your package name:

```ts
export { Image } from './Image.nitro'
```

Use named re-exports like this one. With `export * from './Image.nitro'`, the class export goes missing in Vite dev and in ESM library
output from Rolldown or esbuild.

The exported `HybridObject` is the abstract native base class. Its prototype is the root of every generated class's prototype chain, so
`instanceof` uses ordinary JavaScript behavior without a custom `Symbol.hasInstance`. TypeScript rejects construction of the abstract base,
and its native constructor also throws if called from JavaScript. `nitro-core` gets the native base class with
`NitroModules.getHybridClass('HybridObject')` when it is imported.

For `Image.nitro.ts`, Nitrogen writes:

```text
nitrogen/generated/shared/javascript/
  Image.cjs
  Image.d.cts
```

For an ordinary HybridObject, `Image.d.cts` is `export {}`, so TypeScript only sees the declared `Image` class in the spec. View
declarations also export their generated component, props and ref types, as described below. At runtime the declaration emits nothing, and
`Image` comes from `Image.cjs`. The `.cjs` extension keeps the module CommonJS inside an ESM package. Each class gets a module named after
it, so HybridObject class names must be unique within a library, ignoring case. A spec with several classes has one `export *` line per
class. If a spec re-exports `#nitro/<Name>` but does not declare `<Name>`, for example after you rename a class, Nitrogen fails and names
the line to remove.

`Image.cjs` fetches the native class in a getter on first access and caches it. Bundlers that re-export CommonJS through getters, such as
Rolldown, keep classes lazy until they are used. Node's ESM loader reads CommonJS exports while importing, which fetches classes eagerly.

The registry key uses the `cxxNamespace` from `nitro.json` as a prefix, with dots between components. For
`"cxxNamespace": ["image", "filters"]`, Nitrogen registers `Image` as `image.filters.Image`, and its lazy export looks up that key. Other
modules can declare their own `Image` class. The JavaScript constructor's `name` remains `Image`.

HybridObject headers also have module-qualified include paths. In handwritten C++, use `#include <NitroImage/HybridImageSpec.hpp>`, where
`NitroImage` is the `apple.moduleName`, to select the owning module when another library declares `Image`.

Nitrogen only generates code for HybridObject classes. Other exports from a spec, such as types or helper functions, are ordinary
TypeScript.

Commit `nitrogen/generated` and include it when publishing, along with the `imports` entry, `nitro.json`, and the `.nitro.ts` specs with
their referenced types. If you pass `--out`, the directory must be inside the package, and `#nitro/*` must map to
`<out>/shared/javascript/*.cjs`. Nitrogen deletes files in its output directory that it did not generate, so do not put handwritten files
there.

## React Native views

Declare a view class extending `HybridView` from `react-native-nitro-modules`:

```ts
import { Apple, type HybridView } from 'react-native-nitro-modules'

@Apple({
  language: 'swift',
  implementation: { className: 'HybridTestView' },
})
export declare class TestView extends HybridView {
  isBlue: boolean
  onReady?: () => void
  getOnDropViewCount(): number
}

export * from '#nitro/TestView'
```

Writable properties become React props, including callback properties such as `onReady`. Methods and readonly properties remain available on
the native ref. Fabric creates the view, so omit its constructor or declare it protected. A view requires a concrete native implementation.

Nitrogen adds `TestViewComponent` to the generated `TestView.cjs`. Its getter calls `getHostComponent` on first access and caches the
result, independently of the lazy native class export. The generated `TestView.d.cts` imports the original spec and declares:

```ts
export type TestViewProps = ViewProps & Pick<TestView, 'isBlue' | 'onReady'>
export type TestViewRef = TestView
export declare const TestViewComponent: HostComponent<TestViewProps & { hybridRef?: (view: TestViewRef) => void }>
```

The spec's `export *` exposes these generated declarations. Re-export the component and types from your package entry point by name:

```ts
export { TestView, TestViewComponent, type TestViewProps, type TestViewRef } from './TestView.nitro'
```

Render the component and use `hybridRef` to access the native instance:

```tsx
<TestViewComponent isBlue hybridRef={(view) => console.log(view.getOnDropViewCount())} />
```

`ref` retains React Native's host-instance behavior. The generated props also include ordinary `ViewProps`, such as `style` and `onLayout`.
Consumers must enable `resolvePackageJsonImports` in their TypeScript configuration so `#nitro/*` declarations resolve; React Native's
default TypeScript config disables it.

When Metro compiles `.nitro.ts` sources, enable decorator parsing in the app's Babel config. The TypeScript transform removes declared
classes and their decorators:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  parserOpts: { plugins: ['decorators'] },
}
```

Nitrogen generates Fabric registration and native prop updates alongside the class bindings. Swift implementations conform to the generated
view spec and provide a `UIView`, with the existing update, drop and recycling hooks. Android generation remains unimplemented.

## Inline callbacks

Native code receives a callback parameter as an owning `Callback`, which it can store and call later. If a method, static method or
constructor only calls the callback before it returns, wrap the parameter type in `Inline<...>`:

```ts
import { Apple, type HybridObject, type Inline } from 'nitro-core'

@Apple({
  language: 'swift',
  implementation: {
    className: 'HybridList',
  },
})
export declare class List extends HybridObject {
  forEach(callback: Inline<(item: number) => void>): void
}
```

C++ then receives a `const InlineCallback<...>&` and Swift a `borrowing some InlineCallback<...> & ~Copyable & ~Escapable`. An inline
callback holds the JS function directly, without the heap allocation and `Dispatcher` lookup of an owning `Callback`:

```swift
func forEach(callback: borrowing some InlineCallback<(Double), Void> & ~Copyable & ~Escapable) throws {
  for item in items {
    try callback(item)
  }
}
```

Call `escape()` to keep an inline callback after the call returns. It returns an owning `Callback`. Nitrogen only accepts `Inline` as the
type of a required parameter, and fails for properties, return values, optionals and callbacks nested in other types.

## Inheritance

Extend one declared HybridObject class whose decorator enables `allowInheritance`. Each class declares its own platforms and implementation
mode:

```ts
// Resources.nitro.ts
import { Apple, type HybridObject } from 'nitro-core'

export * from '#nitro/Resource'
export * from '#nitro/File'

@Apple({
  language: 'swift',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
export declare class Resource extends HybridObject {}

@Apple({
  language: 'swift',
  implementation: {
    className: 'HybridFile',
  },
})
export declare class File extends Resource {
  public constructor(path: string)
}
```

Platform options are not inherited. A child may select a subset of its parent's platforms, but must declare its own decorator and
implementation mode for each selected platform. The base spec has no public constructor or static members; a concrete child can declare its
own. Swift's generated protocol and base class each inherit their counterpart from the parent spec.

A base class can come from another package. If TypeScript resolves it to that package's `.nitro.ts` spec, Nitrogen reads the decorators
there. tsc drops decorators from `.d.ts` output, so on every run Nitrogen also writes each class's decorator options to
`hybrid-classes.json` in the output directory. When a base class is declared in tsc's `.nitro.d.ts` output, Nitrogen follows its
`#nitro/<ClassName>` re-export to the other package's output directory and reads the options from the `hybrid-classes.json` there. If the
re-export does not resolve, Nitrogen looks in `nitrogen/generated` next to that package's `nitro.json`. A package that others extend must
publish `nitro.json` and its Nitrogen output directory.

## Swift protocol conformances

`protocolConformances` lists Swift protocols that the generated spec protocol inherits from, in order. Only Swift specs accept it, and it
defaults to none:

```ts
@Apple({
  language: 'swift',
  allowMultipleImplementations: true,
  protocolConformances: [{ protocol: 'ImageSource' }, { protocol: 'Cacheable', module: 'ImageCache' }],
})
export declare class Image extends HybridObject {
  readonly width: number
}
```

```swift
public import NitroModules
public import ImageCache

public protocol HybridImageSpec_protocol: HybridObject, ImageSource, Cacheable {
  var width: Double { get }
}
```

Each protocol must be public, since the generated spec protocol is public. Without `module`, Nitrogen adds no import, so the protocol must
be visible without one. Declare it in the spec's own Swift module, e.g. in `apple/`, or use a standard library protocol like `Sendable`.
With `module`, the generated spec has `public import <module>`. If that module comes from a package rather than an SDK framework like UIKit,
pass it to `addNitrogenTargets(dependencies:)`.

Implementations must satisfy each protocol's requirements. Extensions of these protocols can implement spec members, so implementations
don't have to. When `MemberImportVisibility` is enabled, Swift only uses an extension from another module if the file declaring the
implementation class imports that module. A derived spec inherits the conformances through its parent's spec protocol.

The generated spec protocol redeclares every spec member, so a protocol requirement for the same member must match the generated
declaration. Spec methods are `throws` and `readonly` properties are `{ get }`, so a non-throwing method requirement or a `{ get set }`
property requirement fails to compile. Implement such a member in a protocol extension instead of requiring it.

## Kotlin interfaces

`implementedInterfaces` lists Kotlin interfaces that the generated spec class implements, in order. Only Kotlin specs accept it, and it
defaults to none:

```ts
@Android({
  language: 'kotlin',
  allowMultipleImplementations: true,
  implementedInterfaces: [
    { interface: 'ImageSource', package: 'com.example.images' },
    { interface: 'Cacheable', package: 'com.example.cache' },
  ],
})
export declare class Image extends HybridObject {
  readonly width: number
}
```

```kotlin
import com.example.images.ImageSource
import com.example.cache.Cacheable

abstract class HybridImageSpec: HybridObject(), ImageSource, Cacheable {
  abstract val width: Double
}
```

`package` is required and holds the interface's full package. Unlike `implementation.package`, it is not relative to `android.namespace`.
For a nested interface, put its outer class in `package`, e.g. `{ interface: 'OnClickListener', package: 'android.view.View' }`. Generic
interfaces are not supported. Nitrogen imports each interface by name, so its name must not match another type the spec uses, including
Nitro types such as `Callback` and `Promise`, and the Gradle module must depend on the library declaring it. Implementations must implement
each interface's abstract members. A derived spec inherits the interfaces through its parent's spec class.

The generated spec class redeclares every spec member without `override`. An interface therefore can't declare a property with the same name
as a spec property, or a function with the same name and parameter types as a spec method, because Kotlin would require `override`. This
also applies to interface members with a default implementation, so an interface can't implement spec members the way a Swift protocol
extension can.

On the JVM, a spec property `width` compiles to a `getWidth()` method and, unless it's `readonly`, a `setWidth(value)` method. An interface
function with one of those signatures, such as the Java getter `double getWidth()`, clashes with the property, and the property can't
implement it. An interface property `width` clashes with a spec method `getWidth()` the same way.

## Swift packages

Put `Package.swift` next to `nitro.json` and call `addNitrogenTargets(to:)`:

```swift
// swift-tools-version: 6.4

import PackageDescription

let package = Package(
    name: "NitroImage",
    platforms: [.iOS(.v16)]
)

addNitrogenTargets(to: package)
```

Running Nitrogen adds the helper between `// nitrogen:begin` and `// nitrogen:end` and replaces that section on every run. Keep your package
declaration and helper call outside that section. Nitrogen leaves manifests without an `addNitrogenTargets` call alone.

Add React Native's SwiftPM configuration to `package.json`. Set `name` to your `apple.moduleName`, and list the npm names of every Nitro
module your library depends on:

```json
"swiftpmConfig": {
  "name": "NitroImage",
  "dependencies": ["react-native-nitro-modules"]
}
```

The helper adds the `ReactNative` and `NitroModules` packages, plus the Nitro modules whose types your specs use. React Native links each
library at `ios/build/generated/autolinking/libs/<SwiftName>`, where these relative dependency paths resolve:

| Package                 | Path from the linked library |
| ----------------------- | ---------------------------- |
| `ReactNative`           | `../../../../xcframeworks`   |
| `NitroModules`          | `../NitroModules`            |
| Referenced Nitro module | `../<moduleName>`            |

`NitroModules` also depends on React Native's `React-GeneratedCode` package at `../../../ios`. React Native generates these framework and
codegen packages when preparing the app's iOS build.

For `apple.moduleName: "NitroImage"`, the helper adds the `NitroImage` library and four targets:

- `NitroImageCxx`: your C++ sources in `cpp/` and the specs in `nitrogen/generated/shared/c++`.
- `NitroImageAppleCxx`: the C++ bridge declarations imported by Swift, including the header declaring `registerHybridClasses()`.
- `NitroImage`: your Swift sources in `apple/` and the specs in `nitrogen/generated/apple/swift`.
- `NitroImageSwiftBridge`: the generated C++ wrappers and autolinking sources.

Generated C++ headers live in `include/<Module>/` below their `shared/c++` or `apple/c++` directory. Public headers declare user types,
HybridObject specs, and autolinking functions. Swift wrapper and converter headers live in `include/<Module>/private/`. These directories
contain the declarations themselves, without forwarding headers. Include generated types with their module prefix, for example
`#include <NitroImage/Size.hpp>`.

Each generated Swift type has a private converter pair, such as `Size-Swift.hpp` and `Size-Swift.cpp`. The header forward-declares the Swift
type and declares its `JSIConverter` and `SwiftConverter` specializations. The implementation includes the private Swift umbrella to access
the complete Swift type.

The public `<Module>AppleCxx.h` header contains the C++ bridge declarations that Swift imports. Their definitions remain in
`<Module>-Swift-Cxx-Bridge.cpp`. The private `<Module>-Swift-Cxx-Umbrella.hpp` includes the generated Swift definitions for C++
implementations and must never be imported from Swift.

Pass `swiftSources` and `cxxSources` to use other source paths. Paths are relative to the package root; paths that don't exist are skipped.
C++ source paths are also added to the header search paths:

```swift
addNitrogenTargets(
    to: package,
    swiftSources: ["Sources/NitroImage"],
    cxxSources: ["native/cpp"]
)
```

The helper also accepts `dependencies`, `swiftSettings`, and `cxxSettings`. Extra dependencies apply to all four targets; Swift settings
apply to `NitroImage`, and C++ settings apply to `NitroImageCxx` and `NitroImageSwiftBridge`. Declare packages for extra dependencies in
`Package.swift`. Dependencies on Nitro modules referenced by your specs are added automatically, but their npm packages must still be listed
in `swiftpmConfig.dependencies` for React Native to link them.

Keep `--out` inside the package root. Leave the generated product and target names for the helper, and leave `cxxLanguageStandard` unset or
set it to C++20 or newer. Swift targets use Swift 6 language mode. HybridObject APIs remain nonisolated, and implementations must
synchronize state shared across callers. Native Swift callbacks require `@Sendable` closures; Swift promise awaiting requires a `Sendable`
result.

Build with Swift 6.4's Swift Build backend or Xcode: the generated C++ bridge uses their `GENERATED_MODULEMAP_DIR`. The helper computes
source exclusions when SwiftPM evaluates the manifest. After adding or removing files outside the listed source paths, reset Xcode's package
caches or run `swift package purge-cache` if cached exclusions cause build errors.

## Migration and current limits

Move constructor registration from `nitro.json.autolinking` into each spec's decorator `implementation` object and public constructor, then
remove the `autolinking` field. Keep the namespace and build-module settings in `nitro.json`. Replace interface specs and
`HybridObject<{ ... }>` platform arguments with decorated class declarations extending plain `HybridObject`. Use `allowInheritance: true`
for inheritable specs, and `allowMultipleImplementations: true` for those bases. Use `export declare class` in `.nitro.ts` specs, add the
`imports` entry, and run Nitrogen, which adds `export * from '#nitro/<ClassName>'` for each class. Import or re-export classes from their
relative `.nitro` paths. Ordinary `.ts` and `.d.ts` files can still supply referenced types.

Constructor and method overloads, rest parameters, generic specs and declaration merging are unsupported.

Cross-package Swift class inheritance supports the class bindings described above. Reusing the same callback/promise helper types in
multiple Swift modules still hits an existing helper-conformance generation limitation.

Use `new` for construction. JSI host functions currently also permit direct calls to native constructors.

JavaScript-authored subclasses are unsupported. Public constructors remain public, so TypeScript can accept `class Child extends Image`.
This is not enforced by a private constructor. JSI host functions do not receive `new.target`; the native constructor returns an object with
`Image.prototype`, so `new Child(...) instanceof Child` is false and methods declared on `Child.prototype` are unavailable. Declare
inheritance in the native specs instead.
