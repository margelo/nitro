# Contributing to Nitro

This repository contains `nitro-core`, Nitrogen, `react-native-nitro-modules`, the test environments, and the documentation site. All published packages use the same version. See [RELEASING.md](RELEASING.md) for releases.

## Scope and code review

Keep changes focused. Bug fixes and features need a test that reproduces the problem. A PR containing only a minimal failing test is welcome. Reuse existing specs and types, add the smallest assertion or method that covers the issue, and preserve existing cases. Avoid unrelated refactors and generated boilerplate. AI-assisted contributions must meet the same requirements.

## Development

Use the Bun version in `package.json`:

```sh
bun bootstrap
bun run build
bun typecheck
```

Shared repository commands live in the private `@nitro/scripts` workspace. Call them with `bun --filter @nitro/scripts <command>` from other packages, and use workspace filters for cross-package builds instead of relative paths. The root keeps shortcuts such as `bun sync-core` and `bun build:core`.

`packages/nitro-core/` owns the shared native sources and JS/TS API. `packages/react-native-nitro-modules/` owns the RN entry point and build configuration. `bun sync-core` stages local Core native sources into the RN package before builds and packing. Those staged directories are ignored; edit the authoritative sources in Core.

For Core-only iteration, install with `bun install --frozen-lockfile --ignore-scripts` and run `bun run build:core`. This avoids building the RN JavaScript packages.

The V1 Apple targets require Swift 6.4. React Native apps use Swift Package Manager; `bun example spm` and `bun benchmark spm` resolve their native dependencies.

## Tests and generated bindings

The standalone packages `tests/standalone/nitro-test` and `tests/standalone/nitro-test-external` contain TestObjects, specs, and generated bindings. `tests/standalone/test-runner` runs their JavaScript behavior tests in Hermes through Swift Testing on an iOS simulator and instrumented JUnit on Android. The external package supplies cross-library types and objects. Add runtime regressions that do not need React Native to the runner. Initialize the pinned engine before native tests:

```sh
git submodule update --init --recursive -- tests/standalone/hermes/hermes
bun test:ios
bun test:android
```

See [the standalone guide](tests/standalone/README.md) for native toolchain requirements.

The RN environment in `tests/react-native/` contains the example and benchmark apps. Its `react-native-nitro-test` package supplies benchmark objects and View fixtures. The example app hosts nine Harness View tests and three React Native integration checks.

```sh
bun bootstrap:ios
bun example ios
bun example android
bun test:react-native:ios
bun test:react-native:android
```

See [the RN test guide](tests/react-native/README.md) for setup and test scope.

After editing specs or Nitrogen, generate and commit all bindings:

```sh
bun specs
```

`bun specs` runs Nitrogen for both standalone packages and the RN fixture package. The **Check Nitrogen output** job verifies that all three generated directories match their committed files, including detecting newly generated files.

The standalone iOS and Android jobs run `bun test:prepare` to typecheck the tests, generate their bindings, and bundle the JavaScript and test manifests before native execution. A preparation failure stops the job before the native tests run.

Core changes run both standalone and RN checks. Wrapper changes run RN checks. Nitrogen changes regenerate all fixtures and run the native environments. Workflow filters also include their tests, build configuration, package manifests, and lockfiles.

Sanitizers run in the standalone environment: ASan and TSan on iOS, and ASan on Android. Harness runs without sanitizers on both platforms to check React Native integration and Views. Portable cases run in the standalone suite with sanitizer coverage.

## Performance tests

The benchmark app lives in `tests/react-native/apps/benchmark`. Performance CI is opt-in. A maintainer can request it on a PR with `@nitro-modules-bot please test performance`. See [.github/PERFORMANCE.md](.github/PERFORMANCE.md) for setup and reruns. Both revisions being compared must contain the benchmark app.

## Documentation

Run `bun docs start`, `bun docs typecheck`, or `bun docs build` for the Docusaurus site in `docs/`.

## Before requesting review

- Target `main`.
- Include a regression test for each fix, or describe the expected failure for a reproduction-only PR.
- Build, typecheck, and run the relevant linters and native tests.
- Commit generated bindings and report checks that could not run.
- Use Conventional Commit messages such as `fix:`, `feat:`, `docs:`, `chore:`, or `perf:`.

The React Native CLI still uses the two comment-only Podfiles and library podspec metadata for iOS discovery. Native dependencies build with SwiftPM; no CocoaPods install is required.
