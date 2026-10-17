# Test environments

- [Standalone](standalone/): Hermes, Nitro Core, and generated bindings, run through Swift Testing and JUnit without React Native.
- [React Native](react-native/): Example app, Harness runtime tests, native build integration, fixture libraries, and benchmarks.

Both environments use the workspace Core and Nitrogen packages. Run `bun specs` to regenerate their committed Nitrogen bindings. Portable Harness coverage remains in the RN environment for now.
