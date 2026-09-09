---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Contributing

If you encounter issues with Nitro, want to fix a bug, or reproduce a bug in the example app, you'd need to clone the repo and get it running first.

:::info[Contribution flow and PR rules]
This page covers **environment setup and reproduction** — how to run Nitro locally. For the contribution flow itself (what PRs we accept, the required test-per-fix rule, the nitrogen workflow, and the PR checklist), see [**CONTRIBUTING.md**](https://github.com/margelo/nitro/blob/main/CONTRIBUTING.md) in the repo root. Read it before opening a PR.
:::

The nitro repo is a Bun monorepo, and is set up like this:

- `apps/example/`: A react-native app that uses `react-native-nitro-modules` and `react-native-nitro-test`.
- `packages/`
  - `/nitrogen/`: The Node app that generates Nitro bindings. On npm, it is called `nitrogen`.
  - `/react-native-nitro-modules/`: The core Nitro Modules library which contains mostly C++ code.
  - `/react-native-nitro-test/`: An example Nitro Module library full of specs used as compile-time and runtime tests.
  - `/react-native-nitro-test-external/`: A second test module used to cover cross-module behavior between Nitro Modules.
  - `/template/`: A template for a Nitro Module library.

## Run Nitro Example

### 1. Set up your development environment

You need:

- [Bun](https://bun.sh)
- [CocoaPods](https://cocoapods.org) (installed via Bundler — see below)
- Ruby 2.7.2 (matches CI)
- Xcode 26.2 or higher
- Android Studio

### 2. Clone the repo

Clone [margelo/**nitro**](https://github.com/margelo/nitro) using git, and navigate into the `nitro` folder using Terminal.

### 3. Install dependencies

Using Bun, install all required dependencies:

```sh
bun install
bun run build
```

#### 3.1. (Optional) Install iOS dependencies

If you want to work on the iOS codebase, you also need to install the Pods:

```sh
cd apps/example
bundle install
bun pods
```

### 4. Run the app

After installing all dependencies, you can run the React Native app in `apps/example/`:

<Tabs groupId="platform">
  <TabItem value="ios" label="iOS" default>
    1. Open `apps/example/ios/NitroExample.xcworkspace` in Xcode
    2. Select your target (iPhone Simulator)
    3. Click Run
  </TabItem>
  <TabItem value="android" label="Android">
    1. Open `apps/example/android` in Android Studio
    2. Click Gradle Sync
    3. Click Run
  </TabItem>
</Tabs>

## Reproduce something in the Nitro Example app

With most issue reports, it is required to reproduce the issue in the Nitro example app (`apps/example/`).
Whether it's a build error, a nitrogen error, or a runtime error, there needs to be a way to reproduce it here.
Usually, you can reproduce issues like this:

1. Fork the repository
2. Change the code to reproduce the issue
3. Create a PR to the **nitro** repository which demonstrates the issue

:::tip[You don't need to ship a fix]
A PR that **only reproduces the bug** — and makes CI go red — is a completely valid and very welcome contribution. If you can add a minimal failing test (compile error or runtime error caught by the Harness tests) and open a PR with just that, stop there. You don't have to attempt a fix. A clean, 100% deterministic repro pinned in CI is often more valuable than a guessed patch; the actual fix can be taken from there.

See [You don't need to ship a fix](https://github.com/margelo/nitro/blob/main/CONTRIBUTING.md#you-dont-need-to-ship-a-fix--a-clean-repro-is-enough) in `CONTRIBUTING.md` for details and the test-writing rules (reuse existing types, keep it small, don't remove existing tests).
:::

### Reproduce a build error

If you encounter a build error, compare your setup to the setup in `apps/example/`.
For example, if you have a different setting in your `Podfile`, try changing it here in Nitro `apps/example/` as well to see if it builds here. Submit a PR with the change required to make it fail, and see if the CI fails to build. That alone is enough — you don't need to also fix it.

### Reproduce a nitrogen bug

The Nitro `apps/example/` app uses a Nitro Module (`packages/react-native-nitro-test/`) which acts as an example and contains a lot of test code, like `src/specs/TestObject.nitro.ts` ([link](https://github.com/margelo/nitro/blob/main/packages/react-native-nitro-test/src/specs/TestObject.nitro.ts)). If you change something in `TestObject.nitro.ts`, make sure to run nitrogen from the repo root:

```sh
bun specs
```

Commit the generated files. If that change causes a compile error downstream (e.g. Swift refuses to build the generated code), that's a valid repro on its own — open the PR with the red CI and leave the fix to a maintainer if you don't have one.

When adding a reproduction, follow the rules in [CONTRIBUTING.md](https://github.com/margelo/nitro/blob/main/CONTRIBUTING.md): reuse existing types where possible, don't remove existing test cases, and keep the addition small. Dumping a full user spec into the test module is not the right approach — distill the bug to the minimal type or call that reproduces it.

### Reproduce a runtime error

Submit a PR that demonstrates this runtime error or crash in the Nitro `apps/example/` app — ideally with a new assertion in [`apps/example/src/getTests.ts`](https://github.com/margelo/nitro/blob/main/apps/example/src/getTests.ts) so the regression is caught by the Harness CI workflows (iOS and Android). A PR that only adds the failing assertion and makes Harness go red is enough on its own; you don't have to land the fix.

## Performance tests

Performance CI is opt-in. A maintainer with write, maintain, or admin repository
access can post `@nitro-modules-bot please test performance` on an open PR.
The bot acknowledges it with 👍, adds a status to the PR's checks, and posts the
results or a failure link. Contributors without write access can ask a maintainer
to run it, including for PRs from forks.

See [Performance tests in CONTRIBUTING.md](https://github.com/margelo/nitro/blob/main/CONTRIBUTING.md#performance-tests)
for repeat runs and measurement-only retries.

## Run Nitro Docs

The Nitro docs ([nitro.margelo.com](https://nitro.margelo.com)) are built with [Docusaurus](https://docusaurus.io).

To run the Nitro docs, follow these steps:

### 1. Install dependencies

Navigate into the `docs/` folder, and install all dependencies:

```sh
cd docs
bun install
```

### 2. Run docs (dev)

Then, just run the docs development server using the docusaurus command:

```sh
bun start
```

## Linting

We value code quality and consistent styling.

For JS/TS, we use ESLint and Prettier:

```sh
bun lint
```

For C++, we use clang-format:

```sh
bun lint-cpp
```

For Swift, we use swift format:

```sh
bun lint-swift
```

For Kotlin, we use ktlint:

```sh
bun lint-kotlin
```

Make sure to lint your files everytime before creating a PR. This is also enforced in the CI, but linting beforehand also applies auto-fixes.
