# Hermes for native tests

`tests/standalone/hermes/hermes` pins a commit from the public Hermes `static_h` branch. Normal builds use that commit. Initialize it from the repository root:

```sh
git submodule update --init --recursive -- tests/standalone/hermes/hermes
```

The nested `hermes/` directory contains the upstream checkout; the files beside
it configure the standalone test builds.

The test builds use Hermes' CMake source lists and its bundled JSI. Use the Bun version pinned in the root `package.json`, and install CMake, Ninja and Python 3. Build the host bytecode compiler with:

```sh
bun tests/standalone/hermes/build.mjs host
```

Hermes needs this compiler to generate its internal JavaScript bytecode when compiling for a simulator or emulator. The output stays in the ignored `tests/standalone/.build/hermes/host` directory. Builds are incremental and use up to four jobs by default; pass `--jobs N` to change that limit.

The host compiler uses Release. The iOS and Android test runtimes use Debug, which enables Hermes assertions and its additional consistency checks. This catches invalid native usage during tests and keeps the host compiler fast.

For iOS Simulator, select a full Xcode installation and run:

```sh
bun tests/standalone/hermes/build.mjs ios --arch arm64
```

This also builds the host compiler, then combines the upstream `hermesvm_a` and `jsi` static libraries into `tests/standalone/.build/hermes/ios-simulator-arm64/lib/libNitroTestHermes.a`. It stages the Hermes and JSI headers and creates `tests/standalone/.build/hermes/NitroTestHermes.xcframework` for the local Swift package. Use `--arch x86_64` on Intel Macs. Each XCFramework contains the selected simulator architecture. The default deployment target is iOS 16.0; pass `--deployment-target VERSION` to raise it.

The `Hermes` Swift package wraps that generated XCFramework and supplies its Foundation and CoreFoundation dependencies. Hermes itself is compiled by upstream CMake, so its source lists stay in the submodule. Build the XCFramework before resolving the package; the native test runner does this automatically. All generated headers, archives and build caches stay under `tests/standalone/.build/hermes`.

Android's `:hermes` Gradle library lives in `tests/standalone/hermes/android`. It builds upstream's shared `hermesvm` target and exports it as `hermes::hermesvm` through Prefab. Nitro Core and the test library link the same engine and JSI instance. The module also owns the host compiler task, public header staging, Android Java Unicode helpers and fbjni dependency.

`options.cmake` contains the shared engine options. Source evaluation is enabled. Optional engine extensions, Node-API support and Hermes' own tests are disabled. These dependencies are only used by the native tests and are not included in published npm packages.

To update Hermes, fetch `static_h`, check out the chosen commit in the submodule, and run both native test suites before committing the new gitlink. Builds never follow the branch automatically.
