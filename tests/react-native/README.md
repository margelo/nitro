# React Native tests

`apps/example` hosts the View playground and Harness suite. Harness keeps nine View tests and three React Native integration checks: the installed Core proxy and constructor, package/native version agreement, and the registry including View types. HybridObject behavior cases live in the [standalone suite](../standalone/README.md).

`apps/benchmark` runs the performance suite. `packages/react-native-nitro-test` supplies benchmark objects in C++, Swift, and Kotlin, plus the View fixtures. Cross-library tests live in the standalone `nitro-test` and `nitro-test-external` packages.

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

Keep generated bindings committed. `bun specs` regenerates the RN fixtures and both standalone packages. Add portable behavior tests to the standalone suite and React Native integration or View tests to Harness.
