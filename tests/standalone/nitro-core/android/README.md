# Nitro core Android test module

This local Android library builds `packages/nitro-core/native` without React Native. It compiles every core C++ and Kotlin/Java source directly from the package, with no React Native source exclusions. Its JNI entry point calls the same core registration function as the React Native adapter. The module is a build example for the native tests; it is not a published Android artifact.

`NitroModules` keeps its existing shared-library name. Prefab exports the native headers as `<NitroModules/Header.hpp>`. The header staging task writes only to this module's ignored build directory; implementation files stay in `packages/nitro-core`.

The module depends on the local `:hermes` project for JSI and on fbjni for Java/C++ interop. Core and test libraries link the same Hermes shared library, so neither embeds another engine or JSI copy.

The runtime test project's `settings.gradle` includes both dependencies. From `tests/standalone/runtime/android`, build the core library with:

```sh
./gradlew :nitro-core:assembleDebug
```

Its toolchain and `nitroTestAbi` setting come from the surrounding Gradle build. See the [runtime test instructions](../../runtime/android/README.md) for setup and emulator commands.

Call `com.margelo.nitro.testing.NitroCore.initialize()` once before using fbjni-backed classes or loading a fixture library. This sets up fbjni's `NativeLoader` with a `SystemDelegate` and loads `NitroModules`. The delegate forwards to Android's standard `System.loadLibrary`.
