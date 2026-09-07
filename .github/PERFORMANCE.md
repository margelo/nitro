# Release performance CI

`Nitro Performance` builds the dedicated `apps/benchmark` Release/Hermes app.
Each platform installs base and head side by side on the same machine. For each
benchmark it measures base, then head immediately, before moving to the next
benchmark. There is one AB pair, with five warmup batches and twenty measured
batches per process. Each case gets a fresh app process; installation, startup,
transport and process restarts are outside timing. There is no automatic third
pair. Manual reruns are retained as identifiable workflow attempts.

Each case uses checked-in operation counts from
[`iterations.ts`](../apps/benchmark/src/benchmarks/iterations.ts), separately for
Android and iOS. Both revisions execute identical counts and chunk sizes; the
comparison rejects unequal work. The initial counts are rounded to two significant digits from the measured
medians in [GitHub run 34125332141, attempt 1](https://github.com/margelo/nitro/actions/runs/34125332141/attempts/1),
using `150,000,000 ns / median ns per operation`.
CI does not calibrate or adjust counts from observed speed. A new case requires
an explicit count, and changing counts changes the suite hash.

Review counts when changing the case or testbed. Use the raw batch duration
(`ns/op * iterations / 1e6`) to check whether batches remain long enough to
measure and short enough to fit the job budget. Roughly 150 ms per batch is the
initial sizing target, not a pass/fail bound or a claim of steady performance.
Retune deliberately using representative runs; a slow head must execute all of
the same work. Allocation-heavy cases sum bounded timed chunks with explicit
cleanup outside timing. The eight primitive-only control, method and numeric
property cases skip per-batch GC and native frame waits. iOS buffer copies keep
bounded Hermes GC but skip frame waits: collecting their wrappers releases the
owned native storage. Other allocating cases retain GC and native yields. Raw `iterations`, `chunkIterations` and ordered
`samplesNsPerOp` describe the work. Slow samples are retained.

## Reading results

The main score is the median (p50) of batch averages in ns/op, not individual-call
tail latency. The report shows every observed change of at least 5%, including
Promise cases. This is a presentation threshold, not a calibrated regression
budget. Expand the report for all metrics, individual process medians, matched
pair changes, and sample MAD relative to p50. Matching pooled medians do not prove
equal performance. One pair cannot establish repeatability between launches or justify confidence
intervals. Repeat measurement jobs or same-revision runs to investigate variation.

Performance is currently report-only. Build, execution and malformed-result
failures still fail CI. Turning observed differences into a regression gate needs
empirical validation on unchanged commits and intentional slowdowns on each
unchanged suite/testbed. No Promise case is permanently exempt. Scheduled/manual
runs with the same base and head SHA measure baseline variation explicitly.
Changed benchmark definitions run one head-only measurement per case as a new baseline,
without executing the old base app or publishing an invented paired baseline.
This also handles the first rollout of a new runner protocol.

## Saved apps and measurement reruns

The workflow separates preparation, platform builds, platform measurements and
collection. Each measurement job downloads the immutable app artifact ID produced
by its build job; base and head still run together on one machine. A changed suite
builds only head. An identical base/head SHA reuses the same binary for both sides.
Otherwise each revision is built from its own checkout with the same build script.
Base uses `com.margelo.nitrobenchmark`; head uses `com.margelo.nitrobenchmark.head`.
Android keeps its Java namespace and fully qualified activity name unchanged.
For identical SHAs, both roles launch the single installed head binary.

Use GitHub's **Re-run job and dependent jobs** on `measure-android` or
`measure-ios` to repeat measurements without rebuilding successful ancestors.
Collection downloads the exact result IDs from those jobs. An untouched platform
keeps its original attempt; the report records and links both platform measurement
attempts and their app build attempts. Rerunning all jobs intentionally rebuilds.
Apps and results expire after 30 days; an expired artifact requires a new build.

The app artifact includes base/head SHAs, suite hashes, Release configuration,
architecture and toolchain metadata. iOS apps are tar archives to preserve
permissions and symlinks. Gradle's basic cache is the sole Android cache owner;
Gradle still checks source/task inputs, while exact app reuse is by artifact ID.
There is no new iOS compiler cache. App reuse avoids build work on manual reruns. With 46 cases, a comparable suite
uses 92 fresh processes (46 base + 46 head).
Closer comparisons reduce time separation, but fixed base-first order can still
introduce bias; same-revision runs are needed to assess that on each testbed.

## Artifacts and publishing

The canonical artifact is `performance-report-<attempt>`: raw JSON for every
measured process, plus `performance-report.json` with repository, revisions,
workflow run and attempt provenance, original build metadata and measurement artifact IDs. Artifacts remain available for 30 days.
The PR comment links its exact immutable artifact ID; downloads require GitHub
access. An agent can inspect the JSON instead of scraping the rendered table.

One default-branch `Publish Nitro Performance` workflow handles internal PRs,
forks and main runs. It downloads the exact artifact from the triggering attempt,
validates bounded JSON against GitHub's run and current PR metadata, and computes
the comparison, Markdown and Bencher values from raw samples. It never installs
or executes PR code or app artifacts. Docs-only and cancelled runs skip
publication. Markdown/MDX-only edits also skip measurements inside package/app directories. Relevant failures remain failures. Stale PR results are skipped.

The trusted publisher uses `BENCHER_KEY` as an Actions secret. Its CLI version and
binary digest are pinned. Bencher receives median latency values without invented
bounds; its JSON adapter requires only `value`. PR publications seed both measured
platform baselines at `baseline-<base SHA>` before recording the head at
`pr-<number>`. Main runs record main history. Bencher receives history only: it does not post a second GitHub comment or create alert-driven checks. The trusted renderer owns the one PR comment. User comments are never edited.

Raw app results use schema version 2: fixed work counts replace the calibration
protocol and the runner no longer reports a duration target. The producer and
trusted parser must be merged together before the default-branch reporter can
publish these results. During review, CI still retains the raw artifacts; the
old reporter rejects the new schema instead of misinterpreting it.

## CI runners

Platform builds and measurements use Blacksmith: `blacksmith-4vcpu-ubuntu-2404`
for Android and `blacksmith-6vcpu-macos-26` for iOS. Raw result device descriptions
identify the requested runner tier. Preparation,
collection and trusted publishing remain on GitHub-hosted runners. Changing
runner hardware requires checking same-code variation again; absolute timings
from different hosts are not evidence of a Nitro performance change.

The API 36 x86_64 emulator requires KVM. CI checks `/dev/kvm`, verifies acceleration
before boot and uses `-accel on`; it must not silently use software CPU emulation.
Software GPU rendering is separate. Base/head measurements stay on that machine.
Android process failures retain logcat and process-exit diagnostics. Both platforms
bound boot time to five minutes and individual install/launch commands to two.

The benchmark app shares real Nitro test packages without Harness/navigation UI.
Correctness remains in `apps/example`. See the [benchmark app README](../apps/benchmark/README.md)
for local build and run commands.

## Nitro Modules Bot

The paired PR comparison can post as a dedicated GitHub App named **Nitro Modules Bot**, using [`docs/static/img/nos.png`](../docs/static/img/nos.png)
as its avatar. The app needs no hosted service or webhook receiver; Actions
creates a short-lived installation token just before posting the comment.

To configure it on `margelo/nitro`:

1. Register a GitHub App named `Nitro Modules Bot` with homepage
   `https://nitro.margelo.com`. Disable webhooks and grant only the repository
   permission **Pull requests: Read & write** (Metadata read access is automatic).
   Keep installation restricted to the owning account when the app belongs to
   `margelo`.
2. Upload the NOS image under the app's Display information and install the app
   on only `margelo/nitro`.
3. Generate an app private key and save its PEM contents in the repository's
   Actions secret `NITRO_PERFORMANCE_APP_PRIVATE_KEY`. Keep the key out of git.
4. Set the repository Actions variable `NITRO_PERFORMANCE_APP_CLIENT_ID` to the
   app's Client ID. Set this last, after the key and installation are ready.

The trusted publisher uses the app's actual slug to recognize their own comments.
They request only Pull requests write permission for the current repository, and
the token action revokes the token at the end of the job. Build and measurement jobs never receive the app key. Bencher publishing retains its existing token.
Reporting changes take effect after reaching the default branch.

Without the Client ID variable, comments continue as `github-actions[bot]`.
Removing that variable switches back to the default identity. Configured app
authentication failures fail the posting job rather than silently switching authors.
The first run after switching identities creates a new comment; subsequent runs
update that bot's comment. Earlier comments keep their original author and avatar.

## Remaining upstream warnings

The benchmark now uses the supported ReactModuleInfo constructor and matching
`reactContext` parameter name. Its Gradle property assignments use current syntax.
AGP/RN and Nitro package Gradle warnings remain outside that focused app edit.
Android uses supported `-gpu swiftshader` with required KVM CPU acceleration.

The emulator action hardcodes `cmdline-tools/latest`. Older hosted SDK managers
can still emit the XML v3/v4 metadata warning. Updating only the action does not
replace an installed SDK manager; latest command-line tools 23 also deprecates
`sdkmanager` in favor of the Android CLI. This change logs the selected SDK manager
and version, and leaves provisioning to the runner/action rather than patching its
SDK layout. This inherited warning is not suppressed.
