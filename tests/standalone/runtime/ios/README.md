# iOS runtime tests

Run `bun test:ios` from the repository root with Xcode, an iOS simulator, CMake and Ninja installed. The command prepares the TypeScript tests and Nitrogen bindings, builds the pinned Hermes sources, and runs Swift Testing through `xcodebuild`.

The project has three static framework targets, `NitroModules`, `NitroTestFixtures` and `NitroTestExternal`, and one test bundle. The external fixture remains a separate module so the migrated tests exercise generated bindings across module boundaries. Xcode supplies the simulator test runner. There is no application target or React Native dependency.

`NitroRuntimeTests.xcodeproj` uses synchronized folders to discover sources and generated bindings. It excludes React Native's TurboModule, CallInvoker and Fabric code. The mixed Swift/C++ frameworks preserve the module names and headers emitted by Nitrogen. Hermes is a local Swift package wrapping an XCFramework built from its upstream CMake targets.

`prepare-headers.sh` discovers core and external fixture headers and creates build-directory symlinks for Nitrogen's existing `<NitroModules/Header.hpp>` and `<NitroTestExternal/Header.hpp>` imports. It removes stale links only in those generated directories and rejects duplicate header names within each module. The small umbrella headers expose the Swift/C++ bridge interfaces; they do not list the implementation sources.

The mixed targets remain Xcode targets because [SwiftPM's mixed-language support requires Swift 6.5](https://docs.swift.org/main/documentation/packagemanagerdocs/creatingmixedlanguagetargets/). The current Swift 6.4 toolchain rejects mixed Swift/C++ package targets. Keeping them together lets C++ include the generated Swift header without depending on SwiftPM build internals.

Simulator OS, device, architecture, build jobs and deployment target defaults live in [`config.json`](config.json). By default, the runner selects the newest installed iOS 26 simulator and the host architecture. Override them on the command line:

```sh
bun test:prepare
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
bun tests/standalone/runtime/ios/run.mjs --os 26.5 --device 'iPhone 17 Pro' --arch arm64 --jobs 4

bun tests/standalone/runtime/ios/run.mjs --destination 'platform=iOS Simulator,id=YOUR-SIMULATOR-UDID'
bun tests/standalone/runtime/ios/run.mjs --sanitizer address
bun tests/standalone/runtime/ios/run.mjs --sanitizer thread
bun tests/standalone/runtime/ios/run.mjs --help
```

`--os 26` matches any installed 26.x runtime; `--device` matches an exact name. `--destination` overrides that selection. `NITRO_IOS_DESTINATION` and `NITRO_TEST_JOBS` are also supported, with command-line arguments taking precedence.

`RuntimeTests.swift` reads the generated `runtime-tests.json` manifest and runs each JavaScript test as a Swift Testing parameterized case. New exported tests in `js/**/*.test.ts` need no Swift changes. Each case keeps its file-qualified name in the test results and can be rerun individually in Xcode. Missing, invalid, empty or duplicate manifest entries fail discovery.

The Swift tests await a dedicated serial queue that owns the blocking native runner. This keeps Swift's cooperative executor available for `Promise.async` completions. The command-line runner sets `LIBDISPATCH_COOPERATIVE_POOL_STRICT=1` in the test process so the concurrent native Promise case runs with one cooperative worker.

The Objective-C++ bridge converts a failed assertion or native exception into a Swift error. Handwritten tests check error propagation, cached bytecode with fresh runtime state, per-case timeout overrides, independent setup and execution budgets, and timeouts for unresolved promises, synchronous loops, and endless microtask chains. The automatically discovered TypeScript cases check HybridObject behavior.

`--sanitizer` accepts `none` (the default), `address` (ASan), or `thread` (TSan). CI runs all three modes. Xcode instruments the C++, Objective-C++, and Swift sources compiled for Core, generated bindings, fixtures, and the test runner. The prebuilt Hermes XCFramework is shared across modes and is not instrumented; these jobs check Core's native code, not the engine's internals or RN integration.

Each mode has its own `DerivedData` and timestamped result directories under `tests/standalone/.build/ios/<mode>/`. Results include the `.xcresult` bundle, `xcodebuild.log`, and any sanitizer reports; CI uploads them even on failure. Sanitizer findings terminate the test process, and the runner also fails on sanitizer diagnostics or report files. Open a result bundle in Xcode to inspect failures and logs. The shared JavaScript assertions include the assertion message and JS stack in the native test failure.

CI caches the completed Hermes XCFramework. The exact cache key includes the Hermes pin, architecture, Xcode/SDK and build-tool versions, checkout path, build helpers and iOS defaults. A cache hit passes `--skip-hermes-build`; a toolchain or engine update gets a fresh build. Only use that flag when the existing XCFramework matches the selected architecture and toolchain. Local builds compile Hermes incrementally by default.
