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

`packages/nitro-core/` owns the shared native sources and JS/TS API. `packages/react-native-nitro-modules/` owns the RN entry point and build configuration. `bun sync-core` stages local Core native sources into the RN package before builds and packing. Those staged directories are ignored; edit the authoritative sources in Core.

For Core-only iteration, install with `bun install --frozen-lockfile --ignore-scripts` and run `bun run build:core`. This avoids building the RN JavaScript packages.

## Tests and generated bindings

The standalone environment in `tests/standalone/` runs portable Nitro behavior tests in Hermes through Swift Testing on an iOS simulator and instrumented JUnit on Android. Add runtime regressions that do not need React Native here. Initialize its pinned engine before native tests:

```sh
git submodule update --init --recursive -- tests/standalone/vendor/hermes
bun test:ios
bun test:android
```

See [the standalone guide](tests/standalone/README.md) for native toolchain requirements.

The RN environment in `tests/react-native/` contains the example and benchmark apps plus two fixture libraries. Keep the external fixture separate because it tests cross-library behavior. The example app hosts eight Harness View tests and four React Native integration checks.

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

`bun specs` runs Nitrogen for the standalone runtime, its external fixture, and both RN fixture libraries. The **Check Nitrogen output** job verifies that all four generated directories match their committed files, including detecting newly generated files.

The standalone iOS and Android jobs run `bun test:prepare` to typecheck the tests, generate their bindings, and bundle the JavaScript and test manifests before native execution. A preparation failure stops the job before the native tests run.

Core changes run both standalone and RN checks. Wrapper changes run RN checks. Nitrogen changes regenerate all fixtures and run the native environments. Workflow filters also include their tests, build configuration, package manifests, and lockfiles.

Sanitizers run in the standalone environment: ASan and TSan on iOS, and ASan on Android. Harness runs without sanitizers on both platforms to check React Native integration and Views. Portable cases run in the standalone suite with sanitizer coverage.

## Performance tests

The benchmark app lives in `tests/react-native/apps/benchmark`. Performance CI is opt-in. A maintainer can request it on a PR with `@nitro-modules-bot please test performance`. See [.github/PERFORMANCE.md](.github/PERFORMANCE.md) for setup and reruns. Both revisions being compared must contain the benchmark app.

## Documentation

Run `bun docs start`, `bun docs typecheck`, or `bun docs build` for the Docusaurus site in `docs/`.

## Before requesting review

- Target `core-split` until the reorganization lands on `main`.
- Include a regression test for each fix, or describe the expected failure for a reproduction-only PR.
- Build, typecheck, and run the relevant linters and native tests.
- Commit generated bindings and report checks that could not run.
- Use Conventional Commit messages such as `fix:`, `feat:`, `docs:`, `chore:`, or `perf:`.
