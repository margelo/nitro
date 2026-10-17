# React Native tests

`apps/example` hosts the Harness suite and the interactive test app. `apps/benchmark` runs the performance suite. `packages/react-native-nitro-test` and `packages/react-native-nitro-test-external` supply generated fixtures and native implementations; the external package tests cross-library behavior.

From the repository root:

```sh
bun bootstrap
bun specs
bun bootstrap:ios
bun example ios
bun example android
bun test:react-native:ios
bun test:react-native:android
```

For Android Harness, build the example with `minSdkVersion = 26` in `apps/example/android/build.gradle`, as the Harness workflow does. The hardware-buffer cases require that compile-time setting. The default remains 24 so the other native build jobs check compatibility with that minimum.

Native builds require the platform toolchains and an iOS simulator or Android emulator/device. These apps consume `packages/react-native-nitro-modules`, which stages native sources from the local `packages/nitro-core`. Nitrogen also resolves from this workspace.

Harness CI runs once per platform without sanitizers. ASan and TSan coverage belongs to the [standalone Core tests](../standalone/README.md).

Keep generated bindings committed. `bun specs` regenerates both RN libraries and the standalone fixtures. The Harness cases stay here during this repository move, including portable runtime coverage and view tests.
