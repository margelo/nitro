# react-native-nitro-test

This private package contains the fixtures used by the React Native apps:

- `BenchmarkObjectCpp` and `BenchmarkObjectSwiftKotlin` implement the same benchmark operations in C++ and Swift/Kotlin.
- `TestView` and `RecyclableTestView` cover React Native view properties, methods, callbacks, and lifecycle behavior.

The [benchmark app](../../apps/benchmark) measures the object operations. The [example app](../../apps/example) hosts the views and runs
their Harness tests. HybridObject behavior tests and cross-package fixtures live in [tests/standalone](../../../standalone).

After changing a spec in `src/specs`, regenerate the committed bindings from the repository root:

```sh
bun specs
```

Native implementations live in `cpp/`, `apple/`, and `android/src/main/java/com/margelo/nitro/test/`. `nitro.json` configures their
registration and generated bindings.
