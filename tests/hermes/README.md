# Hermes for native tests

`tests/vendor/hermes` pins a commit from the public Hermes `static_h` branch. Normal builds use that commit. Initialize it from the repository root:

```sh
git submodule update --init --recursive
```

The test builds use Hermes' CMake source lists and its bundled JSI. Install CMake, Ninja and Python 3, then build the host bytecode compiler:

```sh
node tests/hermes/build.mjs host
```

Hermes needs this compiler to generate its internal JavaScript bytecode when compiling for a simulator or emulator. The output stays in the ignored `tests/.build/hermes/host` directory. Builds are incremental and use up to four jobs by default; pass `--jobs N` to change that limit.

The host compiler uses Release. The iOS and Android test runtimes use Debug, which enables Hermes assertions and its additional consistency checks. This catches invalid native usage during tests and keeps the host compiler fast.

For iOS Simulator, select a full Xcode installation and run:

```sh
node tests/hermes/build.mjs ios --arch arm64
```

This also builds the host compiler, then combines the upstream `hermesvm_a` and `jsi` static libraries into `tests/.build/hermes/ios-simulator-arm64/lib/libNitroTestHermes.a`. Use `--arch x86_64` on Intel Macs. The iOS test project links this archive and Apple's Foundation and CoreFoundation frameworks. The native test runner invokes this step automatically.

Android's CMake project includes `Hermes.cmake` and links `NitroTestHermes`. Gradle builds the host compiler first. Hermes uses Android's Java Unicode helpers and the same fbjni dependency as Nitro.

`options.cmake` contains the shared engine options. Source evaluation is enabled. Optional engine extensions, Node-API support and Hermes' own tests are disabled. These dependencies are only used by the native tests and are not included in published npm packages.

To update Hermes, fetch `static_h`, check out the chosen commit in the submodule, and run both native test suites before committing the new gitlink. Builds never follow the branch automatically.
