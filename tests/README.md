# Test environments

- [Standalone](standalone/): TestObjects in `nitro-test` and `nitro-test-external`; JavaScript tests and native suites in `test-runner`, using Hermes, Swift Testing, and JUnit without React Native.
- [React Native](react-native/): View playground, Harness integration and View tests, and benchmarks.

Both environments use the workspace Core and Nitrogen packages. Run `bun specs` to regenerate their committed bindings. Portable runtime coverage runs in the standalone environment. Harness keeps the nine View tests and three React Native integration checks.
