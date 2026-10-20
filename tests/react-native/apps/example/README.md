# Nitro View example

The app mounts and removes `TestView` and `RecyclableTestView` in a grid. Use the
start/stop control to inspect the native views and their lifecycle callbacks.

From the repository root:

```sh
bun bootstrap
bun specs
bun example start
```

In another terminal, run `bun example android`, or run `bun bootstrap:ios` and
`bun example ios` for the iOS simulator.

## Harness tests

The Harness suite checks native view props, layout, rendered pixels, callbacks,
and recycling. It also checks the installed Core proxy, package/native version
agreement, and React Native autolinking.

```sh
bun test:react-native:ios
bun test:react-native:android
```

Portable HybridObject behavior tests live in
[`tests/standalone/nitro-test`](../../../standalone/nitro-test/). Performance tests
run in the separate [benchmark app](../benchmark/).
