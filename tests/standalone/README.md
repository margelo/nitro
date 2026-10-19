# Standalone HybridObject tests

`nitro-test/` contains the C++, Swift and Kotlin HybridObjects used by the tests.
`nitro-test-external/` supplies a separate module for cross-library cases.
`test-runner/` runs the shared TypeScript tests through Hermes, Swift Testing and
JUnit. All three are private workspace packages.

The suites cover primitives, arrays, maps, variants, structs, callbacks,
Promises, buffers, inheritance, object lifetime, and the Nitro registry.
React Native integration and View tests live in `../react-native/`.

```text
tests/standalone/
  nitro-test/
    specs/                 # HybridObject specs, importing nitro-core
    src/                   # Package exports for fixture types
    cpp/                   # C++ implementations
    ios/                   # Swift implementations
    android/               # Kotlin implementations and native library
    nitrogen/generated/    # Committed Nitrogen output
  nitro-test-external/      # Separate Swift/Kotlin fixture module
  test-runner/
    js/                    # Shared TypeScript behavior tests
    scripts/               # Test discovery and bundling
    cpp/                   # Hermes runtime and dispatcher
    ios/                   # Xcode project and Swift Testing suite
    android/               # Gradle project and instrumented JUnit suite
  hermes/                  # Engine build helpers and platform libraries
    hermes/                # Public Hermes static_h submodule, pinned by Git
  nitro-core/android/      # Local Gradle/Prefab adapter for the core sources
  .build/                  # Ignored native build products
```

The platform folders are named for their execution target. Android runs on an
emulator/device because the current runtime uses Android APIs and JNI. iOS runs
in the simulator. These are test projects with no product app or test UI.
Xcode and Gradle provide their test runners. Shared tests require no React Native,
Metro, network connection, or development server at runtime.

## Prepare

Use the Bun version in the root `package.json`, CMake and Ninja. Initialize
the pinned engine explicitly; ordinary package installation does not fetch it:

```sh
git submodule update --init --recursive -- tests/standalone/hermes/hermes
bun install --frozen-lockfile
bun test:prepare
```

`test:prepare` builds the workspace Nitrogen, typechecks the specs and tests,
regenerates bindings, and bundles the JS into `test-runner/build/runtime-tests.js`.
It also writes `test-runner/build/runtime-tests.json`, the case list used by both
native runners, and `test-runner/build/runtime-test-skips.json`, the
platform/build exclusions. The bundle and manifests are generated together.
Commit generated binding changes with their spec. The **Check Nitrogen output**
job regenerates bindings for both test environments and checks for drift. It does
not bundle the JavaScript tests; each native test job runs `test:prepare` before
building and executing its tests.

Run `bun test:ios` on macOS with Xcode, or `bun test:android` with the Android SDK,
NDK, JDK and a running emulator. See each platform directory for its toolchain and
direct CLI command. The two native CI workflows run those same tests and retain
their reports on failure.

CI runs normal, AddressSanitizer (ASan), and ThreadSanitizer (TSan) configurations
on iOS, and normal and ASan configurations on Android. Sanitized builds instrument
Core, the native fixtures, and the test host. Hermes stays uninstrumented.
See the [iOS](test-runner/ios/README.md) and
[Android](test-runner/android/README.md) guides for local sanitizer commands.

React Native Harness runs integration and View tests without sanitizers.

## Writing tests

Specs and shared tests use TypeScript for editor feedback and compile-time checks.
The native engine executes the bundled JavaScript. `chai` supplies assertions:

```ts
import { expect } from "chai";

expect(object.addNumbers(5, 13)).to.equal(18);
expect(await object.calculateFibonacciAsync(10)).to.equal(55n);
```

Chai is pinned to version 5. Version 6 requires `Event` and `EventTarget`, which
this Hermes host does not provide. Adding those APIs belongs in a separate change.

The spec uses Nitro's `Int64` type for the return value, which is a `bigint` in JS.
Typechecking catches invalid test calls; it does not replace runtime assertions or
future generator-specific tests in `packages/nitrogen/tests/`.

Export a named, zero-argument function from any `test-runner/js/**/*.test.ts` file.
It can return `void` or `Promise<void>`:

```ts
import { expect } from "chai";
import { getNitroModules } from "nitro-core";
import type { TestObjectSwiftKotlin } from "nitro-test";

export async function fibonacci(): Promise<void> {
  const object = getNitroModules().createHybridObject<TestObjectSwiftKotlin>(
    "TestObjectSwiftKotlin",
  );
  expect(await object.calculateFibonacciAsync(10)).to.equal(55n);
}
```

The bundler discovers exported values using TypeScript's module information,
without executing test modules in Bun. Keep helper functions unexported or in
separate helper files. Each test gets a file-qualified name, such as
`promises.fibonacci` for a function in `promises.test.ts`. New files and cases
require no Swift/Kotlin edits.

Swift Testing and JUnit run the names as parameterized cases, preserving individual
results and continuing after a case fails. Missing, invalid, or empty case lists
fail discovery. The native error/timeout contract tests remain handwritten.
Jest and Vitest are not needed to run the JS cases.

Larger suites can export a `cases` object whose keys are literal test names.
`casesForTestObjects` binds each case to a fresh C++ or Swift/Kotlin fixture;
`namedCases` prefixes cases that do not use that pair of fixtures:

```ts
import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

export const cases = casesForTestObjects("Numbers", {
  "adds two numbers": (object) => {
    expect(object.addNumbers(5, 13)).to.equal(18);
  },
});
```

The bundler reads literal keys through TypeScript, without evaluating the module
or creating native objects in Bun. It rejects case maps with open string index
signatures, empty suites, invalid callbacks, and exclusions for unknown tests.

Suites with exclusions export a literal `skips` object with `as const`. Each key
matches a case key, and each value maps `ios`, `android`, or `release` to the
exclusion reason. JUnit reports these as assumptions; Swift Testing
puts them in a separate disabled parameterized test. They are never counted as
successful behavior checks. New regressions should fail normally.

## Execution and failures

Each native case creates a fresh Hermes runtime, installs Nitro, loads the bundle,
and calls `runNitroTest(name)`. The runner eagerly compiles the bundle once and
caches its bytecode by source contents. Each runtime evaluates that bytecode with
fresh globals and native objects. Compilation happens before the JS deadlines;
Hermes' watchdog cannot interrupt the native compiler.

The native thread owns the runtime and pumps its dispatcher. On iOS, a dedicated
serial queue runs this blocking work while the Swift test awaits a continuation.
This leaves Swift's cooperative executor free to run `Promise.async` tasks that
the JavaScript case awaits. The iOS runner restricts the cooperative pool to one
worker so the concurrent native Promise test checks this behavior.
Native work runs on background threads; its callbacks are queued back to the
runtime's owning thread. When the microtask queue is empty, the dispatcher sleeps
until a native callback arrives or the deadline expires.
Runtime execution is serialized because Nitro currently has process-wide caches.

An async case keeps that same runtime alive across every `await`. Put repeated
calls, concurrent Promises, or cache-growth checks in one case when they must
share runtime state. The suite checks concurrent native completions and a long
Promise chain with per-iteration captured bindings. This host does not
install timer APIs such as `setTimeout`. Asynchronous helpers yield via
the C++ fixture's native `wait` method. The host exposes `gc()` for
lifetime tests and `__nitroTestPlatform` for platform-dependent assertions.

Fulfillment passes. An assertion, JS exception, rejection, native exception, or
timeout becomes a Swift error or JUnit assertion failure containing the case name
and JS stack. The helper returns a message across the native boundary rather than
exposing JSI values or throwing C++ exceptions into Swift. Bundle setup and test
execution each get a 10-second timeout. Setup cannot consume the test's budget.
`withTestTimeout(150_000, test)` gives the four 55,000-object allocation/disposal
cases 150 seconds to complete. Other tests retain the default, and
the override never extends bundle setup. Native runner contracts pass shorter
explicit limits to check timeouts.
Hermes interrupts synchronous JS loops and endless microtask chains in either
phase; timeout errors identify the phase. Late native callbacks cannot re-enter
the runtime after it closes.

Chai includes expected/actual values in assertion messages with truncation
disabled. There is no custom property-diff reporter or source-map symbolicator
yet. The unminified bundle and its source map are available as build artifacts;
reported stack locations refer to the bundle, not the original TypeScript.
Tests of the runner's failure and timeout paths ensure failures cannot silently
pass. Native fixtures perform their Promise work on background threads.

Cases must return or await all asynchronous work. The host does not track
unhandled rejections from work that a test starts and abandons. Its JS timeout
cannot interrupt a blocking native function; CI also bounds the whole test job.

## Engine and package boundaries

Hermes is built from the pinned public `static_h` source using upstream CMake
targets. See [hermes/README.md](hermes/README.md) for updating the pin and building
the engine. Nothing under `tests/` is included in the published npm packages.

Bun is already pinned by the workspace and bundles TypeScript and Chai into one
IIFE for the native host. Its `browser` target selects module resolution rules;
it does not provide browser globals or downlevel syntax for Hermes. TypeScript's
`ES2022` setting describes the allowed language/library types, not a guarantee
that Hermes implements every API. Native execution checks the actual engine.
Microtasks, execution interrupts, and per-iteration block scoping are explicitly
enabled in the test runtime. Other browser APIs and polyfills are not installed.

The test targets compile sources directly from `packages/nitro-core/native`,
including all Core Swift, Kotlin, and C++ sources for each platform. No React Native
source filters or copied runtime implementation are needed. React Native adapters
live in `packages/react-native-nitro-modules`; their integration coverage runs in
`tests/react-native/`.

On Android, `test-runner` depends on the local `hermes`, `nitro-core`, `nitro-test`,
and `nitro-test-external` Gradle libraries. Each owns its native build and exposes
headers through Prefab. The runner compiles the Hermes host and its JNI bridge. The core
adapter in `nitro-core/android/` demonstrates building the existing sources
without the React Native bootstrap; it is not a published package.
