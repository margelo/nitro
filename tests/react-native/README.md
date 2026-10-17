# React Native tests

`apps/example` hosts the Harness suite and the interactive test app. Harness keeps eight View tests and four React Native integration checks: the installed Core proxy and constructor, package/native version agreement, the registry including View types, and the OS version compared with React Native. Portable runtime cases live in the [standalone suite](../standalone/README.md).

`apps/benchmark` runs the performance suite. `packages/react-native-nitro-test` and `packages/react-native-nitro-test-external` supply generated fixtures and native implementations; the external package tests cross-library behavior.

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

Native builds require the platform toolchains and an iOS simulator or Android emulator/device. These apps consume `packages/react-native-nitro-modules`, which stages native sources from the local `packages/nitro-core`. Nitrogen also resolves from this workspace.

Harness CI runs once per platform without sanitizers. ASan and TSan coverage belongs to the [standalone Core tests](../standalone/README.md).

Keep generated bindings committed. `bun specs` regenerates both RN libraries and the standalone fixtures. Add portable behavior tests to the standalone suite and React Native integration or View tests to Harness.
