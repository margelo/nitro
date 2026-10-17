# Test environments

- [Standalone](standalone/): Hermes, Nitro Core, and generated bindings, run through Swift Testing and JUnit without React Native.
- [React Native](react-native/): Example app, Harness integration and View tests, native build integration, fixture libraries, and benchmarks.

Both environments use the workspace Core and Nitrogen packages. Run `bun specs` to regenerate their committed bindings. Portable runtime coverage runs in the standalone environment. Harness keeps the eight View tests and four React Native integration checks.
