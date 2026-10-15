# Native runtime tests

`runtime/` exercises Nitro through Hermes and the generated Swift/Kotlin bindings.
It has two HybridObject methods: `bounceBoolean` and `calculateFibonacciAsync`.
The same TypeScript cases run on iOS and Android. Existing React Native and
Fabric tests remain in the React Native repository.

```text
tests/
  runtime/
    specs/                # Nitrogen inputs, importing nitro-core
    js/                   # Shared TypeScript behavior tests
    cpp/                  # Hermes runtime and dispatcher
    nitrogen/generated/   # Committed Nitrogen output
    ios/                  # Swift fixtures and Swift Testing target
    android/              # Kotlin fixtures and instrumented JUnit tests
    package.json          # Private workspace, never published
    tsconfig.json
  hermes/                 # Source build helpers for both platforms
  vendor/hermes/          # Public Hermes static_h submodule, pinned by Git
  .build/                 # Ignored native build products
```

The platform folders are named for their execution target. Android runs on an
emulator/device because the current runtime uses Android APIs and JNI. iOS runs
in the simulator. These are test projects with no product app or test UI.
Xcode and Gradle provide their test runners. Shared tests require no React Native,
Metro, network connection, or development server at runtime.

## Prepare

Use the Bun version in the root `package.json`, Node 24, CMake and Ninja. Initialize
the pinned engine explicitly; ordinary package installation does not fetch it:

```sh
git submodule update --init --recursive -- tests/vendor/hermes
bun install --frozen-lockfile
bun test:prepare
```

`test:prepare` builds the workspace Nitrogen, typechecks the specs and tests,
regenerates bindings, and bundles the JS into `runtime/build/runtime-tests.js`.
It also writes `runtime/build/runtime-tests.json`, the case list used by both
native runners. The bundle and case list are generated together.
Commit generated binding changes with their spec. The fixture CI checks for drift.

Run `bun test:ios` on macOS with Xcode, or `bun test:android` with the Android SDK,
NDK, JDK and a running emulator. See each platform directory for its toolchain and
direct CLI command. The two native CI workflows run those same tests and retain
their reports on failure.

## Writing tests

Specs and shared tests use TypeScript for editor feedback and compile-time checks.
The native engine executes the bundled JavaScript. `chai` supplies assertions:

```ts
import { expect } from "chai";

expect(object.bounceBoolean(true)).to.equal(true);
expect(await object.calculateFibonacciAsync(10)).to.equal(55n);
```

Chai is pinned to version 5. Version 6 requires `Event` and `EventTarget`, which
this Hermes host does not provide. Adding those APIs belongs in a separate change.

The spec uses Nitro's `Int64` type for the return value, which is a `bigint` in JS.
Typechecking catches invalid test calls; it does not replace runtime assertions or
future generator-specific tests in `packages/nitrogen/tests/`.

Export a named, zero-argument function from any `runtime/js/**/*.test.ts` file.
It can return `void` or `Promise<void>`:

```ts
export async function fibonacci(): Promise<void> {
  const object = getNitroModules().createHybridObject<TestObject>("TestObject");
  expect(await object.calculateFibonacciAsync(10)).to.equal(55n);
}
```

The bundler discovers exported values using TypeScript's module information,
without executing test modules in Bun. Keep helper functions unexported or in
separate helper files. Each test gets a file-qualified name, such as
`TestObject.fibonacci`. New files and cases require no Swift/Kotlin edits.

Swift Testing and JUnit run the names as parameterized cases, preserving individual
results and continuing after a case fails. Missing, invalid, or empty case lists
fail discovery. The four native error/timeout contract tests remain handwritten.
Jest and Vitest are not needed to run the JS cases.

## Execution and failures

Each native case creates a fresh Hermes runtime, installs Nitro, loads the bundle,
and calls `runNitroTest(name)`. The calling native test thread owns the runtime
and pumps its dispatcher. Native work runs on background threads; its callbacks
are queued back to the runtime's owning thread. When the microtask queue is empty,
the dispatcher sleeps until a native callback arrives or the deadline expires.
Runtime execution is serialized because Nitro currently has process-wide caches.

An async case keeps that same runtime alive across every `await`. Put repeated
calls, concurrent Promises, or cache-growth checks in one case when they must
share runtime state. The suite checks concurrent native completions and a long
Promise chain with per-iteration captured bindings. This host does not
install timer APIs such as `setTimeout`.

Fulfillment passes. An assertion, JS exception, rejection, native exception, or
timeout becomes a Swift error or JUnit assertion failure containing the case name
and JS stack. The helper returns a message across the native boundary rather than
exposing JSI values or throwing C++ exceptions into Swift. The default timeout is
10 seconds; Hermes also interrupts synchronous JS loops. Late native callbacks
cannot re-enter the runtime after it closes.

Chai includes expected/actual values in assertion messages with truncation
disabled. There is no custom property-diff reporter or source-map symbolicator
yet. The unminified bundle and its source map are available as build artifacts;
reported stack locations refer to the bundle, not the original TypeScript.
Tests of the runner's failure and timeout paths ensure failures cannot silently
pass. Native fixtures perform their Promise work on background threads.

Cases must return or await all asynchronous work. The first host does not track
unhandled rejections from work that a test starts and abandons. Its JS timeout
cannot interrupt a blocking native function; CI also bounds the whole test job.

## Engine and package boundaries

Hermes is built from the pinned public `static_h` source using upstream CMake
targets. See [hermes/README.md](hermes/README.md) for updating the pin and building
the engine. Nothing under `tests/` is included in either npm package.

Bun is already pinned by the workspace and bundles TypeScript and Chai into one
IIFE for the native host. Its `browser` target selects module resolution rules;
it does not provide browser globals or downlevel syntax for Hermes. TypeScript's
`ES2022` setting describes the allowed language/library types, not a guarantee
that Hermes implements every API. Native execution checks the actual engine.
Microtasks, execution interrupts, and per-iteration block scoping are explicitly
enabled in the test runtime. Other browser APIs and polyfills are not installed.

The test targets compile the existing core implementation with the RN bootstrap
and Fabric/view integration excluded. They do not maintain copies of runtime
sources or change the published CocoaPods/Gradle integration. RN integration
coverage continues to run in the React Native repository.
