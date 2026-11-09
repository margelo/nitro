---
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# Contributing

If you encounter issues with Nitro, want to fix a bug, or reproduce a bug in the example app, you'd need to clone the repo and get it
running first.

:::info[Contribution flow and PR rules]

This page covers **environment setup and reproduction** - how to run Nitro locally. For the contribution flow itself (what PRs we accept,
the required test-per-fix rule, the nitrogen workflow, and the PR checklist), see
[**CONTRIBUTING.md**](https://github.com/margelo/nitro/blob/main/CONTRIBUTING.md) in the repo root. Read it before opening a PR.

:::

The Nitro repository is a Bun monorepo:

- `packages/nitro-core/`: Shared native runtime and JS/TS API.
- `packages/nitrogen/`: The CLI that generates native bindings.
- `packages/react-native-nitro-modules/`: RN entry point and native build integration.
- `tests/standalone/`: Core runtime tests without React Native.
- `tests/react-native/apps/`: Example and benchmark apps.
- `tests/react-native/packages/`: Benchmark objects and View fixtures.
- `packages/template/`: The RN library template.

## Run Nitro Example

### 1. Set up your development environment

You need:

- [Bun](https://bun.sh)
- Xcode with Swift 6.4 or higher for iOS builds
- Android Studio

### 2. Clone the repo

Clone [margelo/nitro](https://github.com/margelo/nitro) and navigate into the `nitro` folder. Target `v1` for Nitro V1 contributions.

### 3. Install dependencies

Prepare core dependencies, install packages, and build the workspace:

```sh
bun bootstrap
```

All packages resolve from the local workspace. The only submodule is the Hermes engine used by standalone native tests.

#### 3.1. (Optional) Install iOS dependencies

For iOS, set up React Native's SwiftPM dependencies from the repository root:

```sh
bun example spm
```

The example and benchmark apps use React Native 0.88 and SwiftPM. Nitro also supports CocoaPods through its podspecs and the generated
CocoaPods configuration. CocoaPods is not needed to build these apps with SwiftPM.

### 4. Run the app

After installing all dependencies, you can run the React Native app in `tests/react-native/apps/example/`:

<Tabs groupId="platform">
  <TabItem value="ios" label="iOS" default>
    1. Open `tests/react-native/apps/example/ios/NitroExample.xcodeproj` in Xcode
    2. Select your target (iPhone Simulator)
    3. Click Run

  </TabItem>
  <TabItem value="android" label="Android">
    1. Open `tests/react-native/apps/example/android` in Android Studio
    2. Click Gradle Sync
    3. Click Run

  </TabItem>

</Tabs>

Edit shared implementations in `packages/nitro-core`. `bun sync-core` stages those sources into the RN package, and `bun specs` regenerates
the Nitrogen bindings for every test fixture with the local Nitrogen build.

## Reproduce an issue

Add a reproduction to the repository with your issue report. Portable runtime regressions belong in `tests/standalone/`; React Native
integration and View regressions belong in `tests/react-native/apps/example/`. To submit a reproduction:

1. Fork the repository
2. Change the code to reproduce the issue
3. Create a PR to the **nitro** repository which demonstrates the issue

:::tip[You don't need to ship a fix]

A PR that **only reproduces the bug** - and makes CI go red - is a completely valid and very welcome contribution. If you can add a minimal
failing test (compile error or runtime error caught by the standalone or Harness tests) and open a PR with just that, stop there. You don't
have to attempt a fix. A clean, 100% deterministic repro pinned in CI is often more valuable than a guessed patch; the actual fix can be
taken from there.

See [You don't need to ship a fix](https://github.com/margelo/nitro/blob/main/CONTRIBUTING.md#scope-and-code-review) in `CONTRIBUTING.md`
for details and the test-writing rules (reuse existing types, keep it small, don't remove existing tests).

:::

### Reproduce a build error

If you encounter a build error, compare your setup to the setup in `tests/react-native/apps/example/`. For example, reproduce changes to
your Xcode project or SwiftPM dependencies in `tests/react-native/apps/example/` and check whether it still builds. Submit a PR with the
change required to make it fail, and see if the CI fails to build. That alone is enough - you don't need to also fix it.

### Reproduce a nitrogen bug

Add HybridObject specs to
[`tests/standalone/nitro-test/specs/TestObject.nitro.ts`](https://github.com/margelo/nitro/blob/main/tests/standalone/nitro-test/specs/TestObject.nitro.ts).
Use the separate `nitro-test-external` package for cross-library types. View specs belong in
`tests/react-native/packages/react-native-nitro-test/src/specs/`. After changing a spec, run Nitrogen from the repo root:

```sh
bun specs
```

Commit the generated files. If that change causes a compile error downstream (e.g. Swift refuses to build the generated code), that's a
valid repro on its own - open the PR with the red CI and leave the fix to a maintainer if you don't have one.

When adding a reproduction, follow the rules in [CONTRIBUTING.md](https://github.com/margelo/nitro/blob/main/CONTRIBUTING.md): reuse
existing types where possible, don't remove existing test cases, and keep the addition small. Dumping a full user spec into the test module
is not the right approach - distill the bug to the minimal type or call that reproduces it.

### Reproduce a runtime error

Add portable runtime assertions to
[`tests/standalone/test-runner/js/`](https://github.com/margelo/nitro/tree/main/tests/standalone/test-runner/js/). Run `bun test:ios` or
`bun test:android` from the repository root. These suites run through Swift Testing and JUnit, including sanitizer configurations in CI.

For React Native integration or View regressions, add an assertion to the Harness files in
[`tests/react-native/apps/example/__tests__/`](https://github.com/margelo/nitro/tree/main/tests/react-native/apps/example/__tests__). Run
`bun test:react-native:ios` or `bun test:react-native:android`. Harness keeps nine View tests and three integration checks; portable cases
run standalone.

A PR that reproduces the failure is enough; you don't have to include a fix.

## Performance tests

Performance CI is opt-in. A maintainer with write, maintain, or admin repository access can post
`@nitro-modules-bot please test performance` on an open PR. The bot acknowledges it with 👍, updates the PR's `Nitro Performance` status,
and posts the results or a failure link. Contributors without write access can ask a maintainer to run it, including for PRs from forks.

See [Performance tests in CONTRIBUTING.md](https://github.com/margelo/nitro/blob/main/CONTRIBUTING.md#performance-tests) for repeat runs and
measurement-only retries.

## Run Nitro Docs

The Nitro docs ([nitro.margelo.com](https://nitro.margelo.com)) live in the `docs/` folder of
[margelo/nitro](https://github.com/margelo/nitro/tree/main/docs) and are built with [Docusaurus](https://docusaurus.io).

To run the Nitro docs, follow these steps:

### 1. Install dependencies

Clone Nitro and install dependencies from its repository root:

```sh
git clone https://github.com/margelo/nitro.git
cd nitro
bun install --frozen-lockfile --ignore-scripts
```

### 2. Run docs (dev)

Run the docs development server from the Nitro repository root:

```sh
bun docs start
```

Before submitting docs changes, run `bun docs typecheck` and `bun docs build` from the same directory.

## Formatting and linting

Use 140 columns and two-space indentation across the repository. JavaScript and TypeScript use single quotes and no semicolons. The
formatters may keep an indivisible token, URL, or string longer than 140 columns.

Install the JavaScript dependencies with `bun install --frozen-lockfile`. Native formatting uses the installed `clang-format`,
`swift format`, and `ktlint` commands. CI uses clang-format 16.0.6, Swift 6.4.0's bundled formatter, and ktlint 1.8.0 on Java 17. Use
matching versions locally. On macOS, select the appropriate Xcode or set `DEVELOPER_DIR` to its `Contents/Developer` directory.

Format the repository or check it without modifying files:

```sh
bun format
bun format:check
```

Prettier runs directly through its CLI. The native shell scripts select Git-visible files and call their formatter CLI in write or check
mode. They include new files that Git does not ignore and handle filenames containing spaces. Every formatter excludes `nitrogen/generated`.
Build output and vendored sources are also excluded. The Kotlin scaffold template contains unexpanded `$$` identifiers and is excluded from
ktlint because it cannot be parsed until Nitrogen substitutes them.

To run one native formatter, use `bun format:cpp`, `bun format:swift`, or `bun format:kotlin`; append `--check` to check without writing.
For Prettier, use `bun format:prettier --write` or `bun format:prettier --check`. The existing `bun lint-cpp`, `bun lint-swift`, and
`bun lint-kotlin` commands remain aliases. `bun lint` applies ESLint's code-quality fixes, and `bun lint-all` runs formatting followed by
ESLint.

Prettier reads its settings from `package.json` and exclusions from `.gitignore` and `config/format-ignore`. C++ uses
`config/.clang-format`. Swift and Kotlin use `.swift-format` and `.editorconfig` at the root so editors discover them automatically.
Generated sections of Swift package manifests have formatter ignore markers. Keep the template package's Prettier options in sync with the
root package so newly created modules start with the same style.

VS Code recommends and selects the appropriate formatter extensions, while respecting your personal format-on-save preference. C++ uses
`clang-format` on your PATH, Kotlin uses ktlint 1.8.0, and Swift uses the formatter from your selected toolchain.

Each language has its own CI workflow with PR path filters for its source files, configuration, and scripts. The release workflow also runs
all formatting checks on the exact source commit before publishing.
