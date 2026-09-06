---
sidebar_position: 9
---

# Windows

Nitro runs on [react-native-windows](https://microsoft.github.io/react-native-windows/) (RNW).
Hybrid Objects are written in **C++** there - Windows has no equivalent of the Swift and
Kotlin bridges, so `HybridObject<{ windows: 'c++' }>` is the only supported form:

```ts
export interface Math extends HybridObject<{ ios: 'c++', android: 'c++', windows: 'c++' }> {
  add(a: number, b: number): number
}
```

The C++ specs nitrogen generates are shared with iOS and Android, so an existing
C++ Hybrid Object usually needs nothing more than adding `windows: 'c++'` to its
platform spec.

## Installing

```sh
npm i react-native-nitro-modules
npx @react-native-community/cli autolink-windows
```

Autolinking adds `NitroModules.vcxproj` to your app's solution, references it from
your app project, and appends Nitro's package provider to
`windows/<YourApp>/AutolinkedNativeModules.g.cpp`.

Two settings your app project needs, both because Nitro is a C++20 static library:

```xml
<!-- windows/<YourApp>/<YourApp>.vcxproj -->
<PropertyGroup Label="Globals">
  <!--
    C++/WinRT resolves a .winmd through every ProjectReference. A static library
    has none, and the resolution recurses into itself, failing the build with
    MSB4006 "circular dependency ... CppWinRTComputeGetResolvedWinMD".
    An app never produces metadata anyway.
  -->
  <CppWinRTGenerateWindowsMetadata>false</CppWinRTGenerateWindowsMetadata>
</PropertyGroup>

<ItemDefinitionGroup>
  <ClCompile>
    <!--
      Nitro needs C++20. Set it here rather than passing /std:c++20 through
      AdditionalOptions: C++/WinRT adds /await when LanguageStandard is unset,
      which changes _COROUTINE_ABI and makes the app unlinkable against Nitro.
    -->
    <LanguageStandard>stdcpp20</LanguageStandard>
  </ClCompile>
</ItemDefinitionGroup>
```

## Adding Windows to a Nitro Module

Point your module's `.vcxproj` at the property sheet nitrogen generates, and give
react-native-windows the package provider it generates:

```xml
<!-- windows/MyModule/MyModule.vcxproj, after the Microsoft.Cpp.props import -->
<Import Project="$(MSBuildThisFileDirectory)..\..\nitrogen\generated\windows\MyModule+autolinking.props" />
```

```js
// react-native.config.js
module.exports = {
  dependency: {
    platforms: {
      windows: {
        sourceDir: 'windows',
        projects: [
          {
            projectFile: 'MyModule\\MyModule.vcxproj',
            directDependency: true,
            cppHeaders: ['MyModuleAutolinking.hpp'],
            cppPackageProviders: ['MyModule::ReactPackageProvider'],
          },
        ],
      },
    },
  },
}
```

Your `.vcxproj` also needs a `ProjectReference` to `NitroModules.vcxproj`, which is
what puts Nitro's headers on your include path:

```xml
<ItemGroup>
  <ProjectReference Include="$(MSBuildThisFileDirectory)..\..\node_modules\react-native-nitro-modules\windows\NitroModules\NitroModules.vcxproj">
    <Project>{c6e3e6e4-3d5f-4c0b-9a5e-5d2c1b9f7a10}</Project>
  </ProjectReference>
</ItemGroup>
```

The `winrt::` namespace of the generated `ReactPackageProvider` comes from
`windows.windowsModuleName` in [`nitro.json`](../getting-started/configuration-nitro-json.md),
and falls back to `ios.iosModuleName` when it isn't set.

## How Nitro installs itself

Nitro is installed from a two-argument `REACT_INIT` on the `NitroModules` module:

```cpp
void Initialize(ReactContext const& context, facebook::jsi::Runtime& runtime) noexcept;
```

react-native-windows dispatches this through `AddJsiInitializer` on the JS thread,
which is the only JSI entry-point that still works once the New Architecture
(`RnwNewArch=true`) is enabled - `ExecuteJsi`, `TryGetOrCreateContextRuntime` and
`ReactContext::JSRuntime` are deprecated there and either fail-fast in Debug or
silently do nothing in Release. Nitro's `Dispatcher` is backed by
`ReactContext::CallInvoker()`, so callbacks and Promises land on the JS thread.

## Things to know

**Nitro links statically.** `NitroModules.vcxproj` is a `StaticLibrary`, not the DLL
that RNW modules normally are. RNW hands every module image its own `JsiAbiRuntime`
wrapper around the JS runtime, so Nitro in a separate DLL would see a different
`jsi::Runtime*` than the Hybrid Objects linked into the app - and Nitro's `JSICache`,
`PropNameIDCache` and `Dispatcher` are all keyed on the runtime, while
`HybridObjectRegistry` has to be a single registry. Building into the app binary is
what keeps them unique, so Nitro Modules should be static libraries too.

**JSI calls cross an ABI boundary.** On Windows a native module never gets the raw
Hermes runtime; every `jsi::` call goes through `JsiAbiRuntime`, a WinRT proxy inside
`Microsoft.ReactNative.dll`. Nitro is still statically compiled and type-safe, but
individual JSI operations cost more than they do on iOS and Android. Prefer batching
work into fewer, larger calls.

**`Dispatcher::runSync` is unavailable on the UI thread.** `IReactDispatcher` only
exposes `Post`, so `UIThreadDispatcher::runSync()` throws - the same as on iOS.

## Not yet supported

- **Hybrid Views** - `HybridView` has no Windows implementation yet.
- **`react-native-worklets`** - worklet contexts are not wired up on Windows.

### Blocked on react-native-windows

Two types are unusable in one direction because `JsiAbiRuntime` does not implement
them. Both terminate the process rather than throwing, so avoid them in Windows
Hybrid Objects until react-native-windows fixes them upstream.

| | JS → native | native → JS |
|---|---|---|
| `bigint` (`int64_t`, `uint64_t`) | ❌ crashes | ✅ works |
| `ArrayBuffer` | ✅ works | ❌ crashes |

- **`bigint` arguments.** `JsiAbiRuntime::ValueRef::InitValueRef` allocates a
  `PointerValue` for `Symbol`, `String` and `Object`, but `JsiValueKind::BigInt`
  falls through to its `default:` branch and copies the raw ABI handle into the
  `jsi::Value`'s pointer field. The first dereference - `asBigInt()` - is then an
  access violation. Returning a `bigint` to JS takes a different path
  (`JsiAbiRuntime::MakeValue`) that handles it correctly.
- **Returning an `ArrayBuffer`.** `JsiAbiRuntime::createArrayBuffer` is an
  unimplemented stub that calls `VerifyElseCrash(false)`. Reading and mutating a
  buffer that JS allocated works, because `data()` and `size()` are implemented.

`JsiAbiRuntime::setExternalMemoryPressure` is also an empty body, so the GC
pressure a Hybrid Object reports through `getExternalMemorySize()` is ignored on
Windows.
