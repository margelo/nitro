# Releasing Nitro

This repository publishes `nitro-core`, `nitrogen`, and `react-native-nitro-modules` at the same version from one source commit. Each release has one Git tag and one manifest containing all three npm tarballs and their checksums.

## One-time setup

Configure an npm GitHub Actions trusted publisher for each package:

| npm package                  | GitHub repository | Workflow filename |
| ---------------------------- | ----------------- | ----------------- |
| `nitro-core`                 | `margelo/nitro`   | `release.yml`     |
| `nitrogen`                   | `margelo/nitro`   | `release.yml`     |
| `react-native-nitro-modules` | `margelo/nitro`   | `release.yml`     |

The RN package's trusted publisher must point to this repository. Leave the environment empty and enable **Allow npm publish**. The workflow uses npm OIDC authentication and does not need an npm token or separate `npm dist-tag` permission. Committing the workflow does not configure these npm settings.

GitHub Actions needs permission to push the release commit and tag and create releases. Branch protection must allow the workflow's push. Release commits use Marc Rousavy's Git identity (`Marc Rousavy <me@mrousavy.com>`).

## Start a release

In GitHub Actions, open **Release Nitro**, choose **Run workflow** on `main`, and enter an exact version such as `0.37.2` or `0.38.0-beta.1`. The workflow validates the source commit, then prepares and publishes the packages on Ubuntu.

To start a release from the CLI:

```sh
bun release 0.37.2
```

`bun release VERSION [npm-tag]` uses the authenticated GitHub CLI (`gh`) to dispatch **Release Nitro** on `main`. Push the changes you want to release first; local changes and local-only commits are excluded.

Leave `npm-tag` empty to use `latest` for stable versions or the first prerelease identifier, such as `beta` or `rc`. Identifiers that do not start with a lowercase letter use `next`. You can choose a tag explicitly:

```sh
bun release 0.38.0-beta.1 beta
```

A new manual release must increase the current version. To retry an interrupted release, request its existing version and npm tag or rerun the failed workflow. The workflow's `dry-run` option performs the build and validation without committing, tagging, pushing, or publishing.

## Publish through GitHub Releases

Publishing a GitHub release also starts the workflow. Its tag must be exactly `vVERSION` and already point to a commit on `main` whose package, JS, and native versions match `VERSION`. Prepare that commit with `bun version:set VERSION` and refresh `bun.lock` before creating the tag. The package build must leave the tagged checkout unchanged.

This path builds and publishes the existing tag without moving it. The GitHub release is already public while npm publishing runs, so a failed run can leave a public GitHub release with incomplete npm publication. Rerun that workflow to finish it. **Run workflow** is the simpler path when you want CI to prepare the version commit and publish the GitHub release only after npm succeeds.

## Release validation and publication

For a new manual release, CI:

1. Runs the existing build, lint, code generation, standalone runtime, Harness, documentation, and release-tooling workflows against one immutable source commit. Every required job must succeed. iOS builds and Swift runtime tests use macOS; Linux-compatible jobs use Ubuntu, with Windows retained for cross-platform Nitrogen checks.
2. Starts the Ubuntu publishing job after CI succeeds. It updates the root, public packages, RN fixture package, and RN apps to the chosen version. It updates exact internal package dependencies, the JS version, and `NITRO_VERSION`, then refreshes `bun.lock`.
3. Builds and typechecks the versioned workspace and runs the release-tooling tests. Native validation has already passed for the source commit; the publishing job does not install Pods or rebuild the native apps.
4. Packs all three packages. It installs Core and Nitrogen in an isolated consumer to check that they work without RN. A second consumer installs all three packages with RN and checks native sources, declarations, and object/view generation. Package checks reject workspace links, local dependency references, and development files.
5. Commits the version changes, then atomically pushes the commit and `vVERSION` tag.
6. Saves the tarballs and `nitro-release.json` on a draft GitHub release. The manifest is uploaded last and records the source commit, release commit, package versions, and SHA-512 checksums.
7. Publishes `nitro-core`, `nitrogen`, and `react-native-nitro-modules`, in that order, then publishes the GitHub release.

Nitrogen and the RN adapter pin `nitro-core` to the exact release version. Native sources in the adapter tarball are staged from the same local Core package. The template and standalone test packages keep their own versions; the private RN fixture package and apps track the release version.

The workflows use the same resolved commit throughout CI. A new manual release uses the commit selected when the workflow was dispatched. A retry with an existing tag validates that tag's commit. The publisher checks this identity again after resolving the release, including when it reuses saved tarballs.

Main-branch CI runs once through the release workflow's dependencies. Pull requests retain their existing standalone workflows and path filters. Only the publishing job holds the release concurrency lock, so independent CI and later artifact builds can run concurrently.

After package publication, the iOS and Android release-build workflows build the example from the release tag and attach the app artifacts to the same GitHub release. A failure in one of those jobs leaves the npm packages published; rerun the failed artifact job.

## Nightlies

Each push to `main` starts a nightly for its final source commit. A push containing several commits produces one nightly. The version includes the workflow run number and source commit, for example `0.37.2-nightly.123.gabcdef012345`. A stable base of `0.37.1` advances to `0.37.2-nightly...`; a prerelease base of `0.38.0-beta.1` produces `0.38.0-nightly...`. Rerunning the same workflow preserves the version.

Nightlies use the same validation and three-package publication process. CI creates a version commit and tag without advancing `main`, publishes to npm's `nightly` tag, and stores the artifacts on a GitHub prerelease. Stable package versions on `main` and npm's `latest` tag remain unchanged.

An older nightly that finishes after a newer one uses the npm tag `nightly-<release-commit-prefix>` so it cannot move `nightly` backwards. Publication is serialized; GitHub's queue limit still applies during bursts of pushes.

## Resume a failed release

Rerun the failed workflow or request the same version with the same npm tag. For a nightly, rerun the original workflow to preserve its run number and version.

CI reuses the existing tag and saved tarballs, verifies the checksums, and publishes only missing packages. A failure while publishing the RN adapter does not require republishing Core or Nitrogen. A registry or authentication error stops the run; it is never treated as an unpublished version. Conflicting package bytes stop publication before any missing package is published.

Do not delete or move a release tag, replace saved artifacts, or bump again to work around a failed publish. npm versions are immutable. Investigate any integrity mismatch before continuing.

## Development checks

`bun version:set VERSION` updates the shared versions locally. `bun check-versions` checks package versions and exact internal pins, and `bun test:release` tests the release tooling without publishing. The release workflow normally handles the version update.

Run the relevant standalone and RN Harness tests for implementation changes. These suites are also required by the release workflow. See [CONTRIBUTING.md](CONTRIBUTING.md) for validation commands.
