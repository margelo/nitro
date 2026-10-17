# Runtime test migration from main

Source: `40d58894b` on `main`. The behavior cases come from
`apps/example/__tests__`; their native fixtures come from
`packages/react-native-nitro-test` and `packages/react-native-nitro-test-external`.

The migration preserves the source assertions and fixture behavior, including
known failures. Production Nitro and Nitrogen fixes belong in follow-up PRs.
Existing exclusions for unsafe or unsupported platform/build combinations remain
explicit; failures introduced by running the migrated cases are not excluded.

## Inventory

Each shared test runs against both `TestObjectCpp` and
`TestObjectSwiftKotlin`, except suites that explicitly target one implementation.
The counts below include those individual implementation cases and expanded
data-driven cases.

| Source suite   | Migrated cases |
| -------------- | -------------: |
| array-buffers  |             82 |
| arrays         |            118 |
| callbacks      |             96 |
| cpp-only       |             52 |
| errors         |             28 |
| external       |             48 |
| hybrid-objects |             86 |
| inheritance    |             60 |
| maps           |            126 |
| memory         |             11 |
| nitro-modules  |             76 |
| optionals      |            118 |
| primitives     |            164 |
| promises       |             66 |
| stress         |              2 |
| structs        |            116 |
| variants       |            166 |
| **Total**      |      **1,415** |

The inventory includes the portable `PlatformObject.getOSVersion()` assertion
split from the original React Native comparison. The two JS runner checks and
the native runner contract tests remain alongside these suites. The Promise
runner check uses `TestObjectSwiftKotlin`. The original boolean/Fibonacci
placeholder fixture and its three cases are removed; the full fixtures are
defined in `runtime/specs/TestObject.nitro.ts`.

## Exclusions and adaptations

- Harness keeps all eight `nitro.views.harness.tsx` cases for React Native
  rendering, view refs, Fabric, and recycling. Their specs and native
  implementations stay in the React Native fixtures, including `getIsViewBlue`.
- The standalone `PlatformObject` case checks that the OS version is a nonempty
  string. Harness keeps the comparison with React Native's `Platform` constants.
- Standalone registry expectations omit the two view registrations, and version
  checks use `nitro-core`. Harness retains the React Native registry and package
  version checks, plus the installed Core proxy and constructor identity check.
  These four integration checks and the eight View cases are its remaining tests.
- HardwareBuffer tests remain: Android platform APIs do not require React Native.
- The external fixture remains a separate native module, preserving tests of
  cross-module HybridObjects and optional primitives.
- Harness assertions become Chai assertions. Callback recording and native
  waits replace Harness spies/polling and JavaScript timer dependencies.
  Identity checks preserve `Object.is` behavior, and the two variant assertions
  with omitted optional fields preserve `toEqual`'s undefined-key semantics.
- The host supplies platform metadata and `gc()` directly through JSI.

The two package `src/__tests__/index.test.tsx` files contain only
`it.todo('write a test')`, so they contribute no executable cases. The 18
`scripts/performance/*.test.ts` suites test the React Native benchmark/reporting
toolchain (Bun, subprocesses, filesystem, GitHub reports). They remain in
`scripts/performance/` and run through Bun.
