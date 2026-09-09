# Contributing to Nitro

Thanks for your interest in contributing! Nitro powers thousands of React Native libraries, so every change that lands on `main` ships to a lot of apps. This document explains how the project works, what we expect from pull requests, and the test flow that every bug fix has to follow.

> **AI assistants and automated tools:** this file is the source of truth for how to work in this repo. Read it end-to-end before making changes.

**Short version:** You have two good ways to contribute a bug report:

1. **Repro-only PR** — add a minimal failing test (compile or runtime) to this repo so CI goes red, and stop there. See [You don't need to ship a fix](#you-dont-need-to-ship-a-fix--a-clean-repro-is-enough).
2. **Repro + fix PR** — the same test, plus the fix that makes CI green again. See [The bug-fix flow](#the-bug-fix-flow).

Either is welcome. A clean, deterministic repro is often more valuable than a guessed patch.

## Philosophy

- **Selective merges.** We accept PRs, but we are opinionated about what goes into `main`. Bug fixes and well-scoped features are welcome; broad refactors, stylistic rewrites, and drive-by cleanups usually are not.
- **Proper fixes, not patches.** We would rather have a small, well-understood fix with a regression test than a larger "it seems to work now" change. Workarounds and defensive `try/catch`-style patches that paper over a root cause will not be merged.
- **No AI slop.** Generated code, unnecessary abstractions, speculative refactors, and boilerplate-heavy "test spam" are rejected on sight. Human-authored or AI-assisted is fine — but the diff has to be tight, necessary, and match the style of the surrounding code.
- **CI is the safety net.** The repo is covered by multiple CI matrices (build, harness runtime tests, lint) across iOS and Android. If CI can catch a regression, it should — we avoid anything that requires manual user testing to verify.

## Repo layout

Nitro is a Bun monorepo:

- [apps/example/](apps/example) — React Native example app that hosts the runtime test harness.
- [packages/nitrogen/](packages/nitrogen) — the `nitrogen` code generator.
- [packages/react-native-nitro-modules/](packages/react-native-nitro-modules) — the core Nitro C++ library.
- [packages/react-native-nitro-test/](packages/react-native-nitro-test) — a Nitro module full of specs used as compile-time and runtime tests.
- [packages/react-native-nitro-test-external/](packages/react-native-nitro-test-external) — a second Nitro module used to cover cross-module behavior.
- [packages/template/](packages/template) — the `npx nitrogen init` template for new Nitro Modules.
- [docs/](docs) — the Docusaurus site at [nitro.margelo.com](https://nitro.margelo.com).

Setup instructions (toolchain, pods, running the example app) live in the docs contributing page: <https://nitro.margelo.com/docs/resources/contributing>. This file focuses on the contribution flow itself.

## Tooling

We use **Bun** as the package manager and task runner. Don't use `npm`, `yarn`, or `pnpm` — the lockfile and workspace scripts assume Bun.

```sh
bun install         # install all workspaces
bun run build       # build nitro, nitrogen, and the test modules
bun specs           # regenerate nitrogen output for react-native-nitro-test
bun lint-all        # run all linters (JS/TS, C++, Swift, Kotlin)
```

## You don't need to ship a fix — a clean repro is enough

The most useful thing you can contribute for a bug you can't fix yourself is a **PR that makes CI go red**. If you can reproduce your bug inside this repo as:

- a **compile error** — add the minimal spec to [packages/react-native-nitro-test/src/specs/](packages/react-native-nitro-test/src/specs) that causes nitrogen output to fail to build, or
- a **runtime error** — add the minimal failing assertion to [apps/example/src/getTests.ts](apps/example/src/getTests.ts) so the Harness workflows ([harness-ios.yml](.github/workflows/harness-ios.yml), [harness-android.yml](.github/workflows/harness-android.yml)) catch it,

then open a PR with just that change. Don't attempt a fix. A red CI run that deterministically pins the bug is often more valuable than a guessed patch — once the repro is in, the actual fix can be taken from there.

The rules from ["Writing good tests"](#writing-good-tests) below still apply to repros: reuse existing types, keep the addition small, don't remove other tests. A small, clean, 100% reproducible repro PR is always welcome.

## The bug-fix flow

**Every bug fix MUST ship with a test.** No exceptions. The test can take one of two forms:

### 1. Runtime test

A runtime test lives in [apps/example/src/getTests.ts](apps/example/src/getTests.ts) and exercises a spec from [packages/react-native-nitro-test/src/specs/](packages/react-native-nitro-test/src/specs). It runs:

- locally in the example app via the "Run Tests" screen / `getTests`, and
- in CI on both iOS and Android via the **Harness** workflows ([harness-ios.yml](.github/workflows/harness-ios.yml), [harness-android.yml](.github/workflows/harness-android.yml)).

Use a runtime test when the bug is about behavior — wrong value returned, wrong lifecycle, wrong threading, a crash, etc.

### 2. Compile-time / build test

A compile-time test lives in the specs of [react-native-nitro-test](packages/react-native-nitro-test/src/specs) (or [react-native-nitro-test-external](packages/react-native-nitro-test-external/src/specs) for cross-module cases). The "test" is that nitrogen generates code for the spec and the native build succeeds. This is covered in CI by the [build-ios.yml](.github/workflows/build-ios.yml) and [build-android.yml](.github/workflows/build-android.yml) workflows.

Use a compile-time test when the bug is about code generation — especially Swift compiler quirks. We have accumulated a lot of Swift compiler workarounds; each one is pinned in place by a spec (a specific struct, enum, tuple, protocol shape, etc.) that used to fail to compile. Once the workaround is applied, the spec can never silently regress because the native build would break.

Examples of things that belong as compile-time tests: specific generic shapes, enum payloads, variants, tuples, optional wrappers, inheritance chains, anything that previously tripped Swift/Clang/Kotlinc.

### Writing good tests

Tests must be **minimal and non-polluting**:

- **Reuse existing types.** If `Car`, `Person`, `TestObject`, `Base`, `Child`, etc. already exist in the specs, use them. Don't introduce a parallel `MyBugRepro` struct just for your test.
- **Add, don't rewrite.** Don't remove or restructure existing specs or test cases — older tests cover older bugs, and removing them drops coverage. Add the smallest new method, property, or assertion that pins your bug.
- **No spec dumps.** Do not paste a full user-reported spec into the test module to "make it fail". Distill the bug down to the one type or call that actually reproduces it.
- **One test per bug.** A new assertion in `getTests.ts` or a single new method on an existing spec is usually enough.

If a PR adds dozens of new structs, enums, or spec files to reproduce a bug, it will be asked to shrink before review.

## Workflow for a bug fix

1. **Reproduce the bug** in the example app, ideally by adding a failing test first.
2. **Add the test** — runtime (`getTests.ts` + a spec addition) or compile-time (a spec addition), per the rules above.
3. **Run nitrogen** to regenerate the native bindings:
   ```sh
   bun specs
   ```
   This runs `nitrogen` for `react-native-nitro-test` (and transitively for `react-native-nitro-test-external`). Commit the generated files.
4. **Implement the fix** on the native side (C++, Swift, or Kotlin) and/or in nitrogen itself.
5. **Verify locally:**
   - `bun run build` — all packages build.
   - `bun typecheck` and `bun lint-all`.
   - Build and run the example app on iOS and/or Android, and run the tests from the "Run Tests" screen.
6. **Open a PR.** Describe the bug, link the issue, and point at the test you added.

For new features, the same flow applies: add the spec, run `bun specs`, implement natively, cover it with a runtime assertion in `getTests.ts` where possible.

## What CI runs on your PR

- **Build:** iOS and Android builds of the example app and both test modules.
- **Harness:** runtime tests from `getTests.ts` executed on iOS and Android.
- **Lint:** TypeScript, C++ (clang-format), Swift (swift-format), Kotlin (ktlint).
- **Nitrogen:** regeneration check — generated output must match what's committed.

If any of these fail, the PR won't be merged. Fix the root cause; do not disable or skip checks.

### Performance tests

Performance CI runs only when requested on an open PR. Someone with **write**,
**maintain**, or **admin** access to this repository can post:

```text
@nitro-modules-bot please test performance
```

The bot adds 👍 when it accepts the request. `Nitro Performance / <run ID>`
appears in the PR's checks area: yellow while running, green on success, red on
failure. Click it to see the logs. The bot also posts a comparison table, or a
failure comment linking to the failed run. Contributors without write access can
ask a maintainer to run it for their PR; fork PRs are supported.

Each new command creates a separate run and report. Re-run the same workflow to
update its existing comment. Re-running `measure-android` or `measure-ios` and
their dependent jobs reuses the saved apps. After a new report is posted, older
performance comments from the bot are marked **Outdated**. Pushing another commit
does not start a performance run; post the command again to test that commit.

See [performance CI](.github/PERFORMANCE.md) for the measurement method and artifacts.

## Pull request checklist

Before requesting review, make sure:

- [ ] The PR targets `main` and has a clear, narrow scope.
- [ ] There is a test (runtime or compile-time) that pins the bug.
  - For **repro-only PRs**: the test fails in CI (that's the point — say so in the PR description).
  - For **fix PRs**: the test fails on `main` and passes with your fix applied.
- [ ] `bun specs` has been run and the generated files are committed.
- [ ] `bun lint-all` passes locally.
- [ ] You did not remove existing specs or test cases.
- [ ] The diff does not contain unrelated refactors, reformatting, or speculative changes.
- [ ] Commit messages follow Conventional Commits (`fix:`, `feat:`, `docs:`, `chore:`, `perf:`). The changelog is generated from these.

## Reporting bugs without a fix

See [You don't need to ship a fix](#you-dont-need-to-ship-a-fix--a-clean-repro-is-enough) above. The short version: a PR that adds a minimal failing test and makes CI red is a legitimate and very welcome contribution on its own. The [docs contributing page](https://nitro.margelo.com/docs/resources/contributing) has the reproduction walkthrough for running things locally first.

## Questions

If you are unsure whether a change fits, open a draft PR or an issue describing the approach **before** writing a lot of code. A two-line comment saving a thousand-line PR from being closed is a good trade for everyone.
