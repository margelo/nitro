# Android HybridObject fixtures

This library builds the `nitro-test` C++ and Kotlin implementations and their generated bindings as `libNitroTest.so`. It depends on the local `nitro-core` and `nitro-test-external` libraries and exports native headers through Prefab.

The [test runner](../../test-runner/android/README.md) includes this module in its Gradle build and supplies the Android toolchain settings. From that project, build the fixtures with:

```sh
./gradlew :nitro-test:assembleDebug
```

Call `com.margelo.nitro.test.NitroTest.initialize()` before creating the fixture objects. It initializes Core, loads the external fixture library, and registers the main fixtures.
