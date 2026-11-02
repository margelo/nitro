# iOS runtime tests

Run `bun test:ios` from the repository root with Xcode, an iOS simulator, CMake and Ninja installed. The command prepares the TypeScript
tests and Nitrogen bindings, builds the pinned Hermes sources, and runs Swift Testing through `xcodebuild`.

The root `Package.swift` defines the runtime, both fixture modules, the native test runner and a SwiftPM test target. It compiles canonical
sources directly from `packages/nitro-core/native`, with separate C++, Apple C++, Swift and Swift-to-C++ bridge targets. The fixture modules
use the same target split as Nitrogen's generated React Native packages. Xcode supplies the simulator test runner; there is no application
target or React Native dependency.

The V1 runtime requires Swift 6.4. Its Swift target links [SimdUTF](https://github.com/margelo/simdutf-swift) 1.0.1 or newer with the
`UTF8`, `UTF16`, and `ASCII` traits. Public include directories expose the existing `<NitroModules/Header.hpp>` imports. The private bridge
targets compile after Swift and include its generated headers.

The core, fixture modules, test runner, and generated React Native packages use Swift 6 language mode. HybridObject entry points remain
synchronous and nonisolated; implementations synchronize shared mutable state.

Hermes is a local XCFramework built from the pinned upstream CMake sources. Its binary target lives in the root manifest so the framework
and all canonical runtime sources stay inside the Swift package boundary. Run the existing Hermes build helper before opening the package in
Xcode. The command-line build script builds Hermes automatically unless `--skip-hermes-build` is passed.

For Xcode debugging, prepare the tests and Hermes, then open the existing project:

```sh
bun test:prepare
bun tests/standalone/hermes/build.mjs ios --arch arm64 --jobs 4
open tests/standalone/test-runner/ios/NitroRuntimeTests.xcodeproj
```

Select the `NitroRuntimeTests` scheme and an iOS simulator, then run Product > Test. The project links the root package's
`NitroTestRunnerBridge` product, which builds the runtime, fixtures and Hermes dependencies through SwiftPM. The project only compiles
`RuntimeTests.swift` and copies the generated test resources. `bun test:ios` and CI use this same project and scheme. Native breakpoints
resolve to the same package sources used by the command-line runner.

`RuntimeTests.swift` loads the JavaScript and case manifests from the test bundle in the Xcode project, or from `Bundle.module` when running
the package tests directly. `NitroTestRunnerBridge` exports the Objective-C++ test entry point to Swift.

Simulator OS, device, architecture, build jobs and deployment target defaults live in [`config.json`](config.json). By default, the runner
selects the newest installed iOS 26 simulator and the host architecture. Override them on the command line:

```sh
bun test:prepare
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
bun tests/standalone/test-runner/ios/build.mjs --arch arm64 --jobs 4
bun tests/standalone/test-runner/ios/run.mjs --os 26.5 --device 'iPhone 17 Pro' --arch arm64

bun tests/standalone/test-runner/ios/run.mjs --destination 'platform=iOS Simulator,id=YOUR-SIMULATOR-UDID'
bun tests/standalone/test-runner/ios/build.mjs --sanitizer address --skip-hermes-build
bun tests/standalone/test-runner/ios/run.mjs --sanitizer address
bun tests/standalone/test-runner/ios/build.mjs --sanitizer thread --skip-hermes-build
bun tests/standalone/test-runner/ios/run.mjs --sanitizer thread
bun tests/standalone/test-runner/ios/build.mjs --help
bun tests/standalone/test-runner/ios/run.mjs --help
```

`--os 26` matches any installed 26.x runtime; `--device` matches an exact name. `--destination` overrides that selection.
`NITRO_IOS_DESTINATION` and `NITRO_TEST_JOBS` are also supported, with command-line arguments taking precedence.

`ios/build.mjs` builds Hermes and compiles the test bundle once with `build-for-testing`. `ios/run.mjs` runs every suite in one
`test-without-building` invocation, using the generated `.xctestrun` file directly. It does not resolve packages or compile sources. CI
calls these scripts in separate steps so compilation and test durations are visible. `bun test:ios` prepares the fixtures, builds, then runs
the tests through the workspace package commands. For a sanitizer run, build and run with the same `--sanitizer` value as shown above.

`RuntimeTests.swift` reads the generated `runtime-tests.json` manifest and runs each `.test.ts` file as a Swift Testing parameter. New
exported tests in `js/**/*.test.ts` need no Swift changes. Suites can be rerun individually in Xcode. After a case fails, the remaining
cases continue in a fresh runtime. The suite reports all failed case names and JS stacks. Bundle setup failures stop the suite. Missing,
invalid, empty or duplicate manifest entries fail discovery.

The Swift tests await an operation queue limited to four concurrent suites. Each file creates one fresh Hermes runtime and executes its
cases in order, with JavaScript and callbacks on its owning worker. The runtime is destroyed after the file finishes or a case fails, before
the remaining cases start in a new runtime. This keeps Swift's cooperative executor available for `Promise.async` completions. The queue
uses user-interactive QoS, matching React Native's JS thread, so Swift tasks started by `Promise.async` inherit that priority. The shared
Xcode scheme and command-line runner set `LIBDISPATCH_COOPERATIVE_POOL_STRICT=1` in the test process so the concurrent native Promise case
runs with one cooperative worker.

The static-property cases belong to `objects.test.ts`, so their writes to shared native storage run sequentially. They restore the original
values before returning.

The Objective-C++ bridge converts a failed assertion or native exception into a Swift error. Handwritten tests check error propagation,
cached bytecode with shared state within a suite and fresh state between suites, per-case timeout overrides, independent setup and execution
budgets, and timeouts for unresolved promises, synchronous loops, and endless microtask chains. Compilation and native installation finish
before the bundle's JavaScript deadline starts. A concurrency contract uses a separate queue with the same four-worker configuration so its
rendezvous does not wait behind behavior suites. It submits five tests and makes the first four initialized runtimes meet, checking overlap,
the worker limit, isolated globals, and Swift Promise callbacks. The automatically discovered TypeScript cases check HybridObject behavior.

`--sanitizer` accepts `none` (the default), `address` (ASan), or `thread` (TSan). CI runs all three modes. Xcode instruments the C++,
Objective-C++, and Swift sources compiled for Core, generated bindings, fixtures, and the test runner. The prebuilt Hermes XCFramework is
shared across modes and is not instrumented; these jobs check Core's native code, not the engine's internals or RN integration.

Each mode has its own `DerivedData` and timestamped result directories under `tests/standalone/.build/ios/<mode>/`. Results include the
build and test `.xcresult` bundles, Xcode logs, live test events, a test summary, and any sanitizer reports; CI uploads them even on
failure. Test results print as Xcode reports them, followed by the final pass/fail/skip counts. CI also writes the counts to the job
summary. Verbose simulator diagnostics are disabled so an assertion failure does not wait for a sysdiagnose. Sanitizer findings terminate
the test process, and the runner also fails on sanitizer diagnostics or report files. Open a result bundle in Xcode to inspect failures and
logs. The shared JavaScript assertions include the assertion message and JS stack in the native test failure.

CI caches the completed Hermes XCFramework. The exact cache key includes the Hermes pin, architecture, Xcode/SDK and build-tool versions,
build helpers and iOS defaults. A cache hit passes `--skip-hermes-build`; a toolchain or engine update gets a fresh build. Only use that
flag when the existing XCFramework matches the selected architecture and toolchain. Local builds compile Hermes incrementally by default.
