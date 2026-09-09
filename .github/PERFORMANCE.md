# Release performance CI

Start a performance comparison by posting a new PR comment containing exactly:

```text
@nitro-modules-bot please test performance
```

The PR must be open, and GitHub must report **write**, **maintain**, or **admin**
access for the commenter in this repository. Read/triage access, org membership
alone, and access to a fork do not grant permission to start these runs. Other
users can post the command, but it will not run benchmarks or receive a reaction.
Editing an existing comment does not start a run. Pushes, PR updates, schedules,
and the Actions dispatch button do not start performance runs. Manual requests run
regardless of which files changed, including docs-only PRs.

An accepted request gets a 👍 reaction from the bot. The PR's checks area shows
one `Nitro Performance` entry, with a yellow pending status while it runs,
green on success, or red for failures/cancellation. The status links to the run
logs; publishing failures link to the publishing workflow. New requests replace
this entry, and older runs finishing later cannot overwrite it. Each status belongs
to the tested head commit, even if the PR advances while measurements run.

Failures also produce a PR comment with direct links to the benchmark attempt
and publishing logs. Re-running the failed workflow updates the same comment.
If report publishing fails after measurements succeeded, available results stay
in that comment. A failed run leaves earlier successful reports visible.

Each request starts an independent workflow run and posts a new report comment,
even when the commits have not changed. Re-running jobs within that workflow
updates only that run's report, using its workflow run ID. Requests do not cancel
one another. After publishing a report, the bot minimizes its older performance
comments as **Outdated**, including legacy reports. It leaves other authors and
unrelated comments alone; rerunning an older run never hides a newer report.
The artifact links and attempt details are collapsed under
**Raw measurements and artifacts**.

The comment trigger and trusted publisher take effect after merging into the
default branch. A comment event points at the default branch, so preparation
resolves the PR's current base/head SHAs and head repository through GitHub before
checking out either revision. Forks are supported. Re-running all jobs resolves
the current PR revisions again; measurement-only reruns reuse the saved apps.

`Nitro Performance` builds the dedicated `apps/benchmark` Release/Hermes app.
Each platform installs base and head side by side on the same machine. It
runs four pairs at each position in the apps' suite order: **AB, BA, BA, AB**
(A = base, B = head), then moves to the next position. It finishes any remaining
cases in the longer suite. With the same case order, each function runs back to
back with each revision first twice. Each launch gets a fresh app process,
five warmup batches and twenty measured batches: eighty measured batches per
revision and case. Installation, startup, transport and process restarts are
outside timing. Apps are built and installed once, then reused across all four
pairs. Manual reruns are retained as identifiable workflow attempts.

Startup waits for two animation frames, with no fixed one-second sleep. Keep
the frame handoff and warmup: synchronous JS does not prevent native startup
work or OS scheduling from competing for the CPU. The Android crash monitor's
one-second polling interval runs concurrently and does not delay measurements.

Each case uses checked-in operation counts from
[`iterations.ts`](../apps/benchmark/src/benchmarks/iterations.ts), separately for
Android and iOS. Each revision uses its own checked-in counts and chunk sizes.
Timings are divided by the operation count before comparison. The initial counts are rounded to two significant digits from the measured
medians in [GitHub run 34125332141, attempt 1](https://github.com/margelo/nitro/actions/runs/34125332141/attempts/1),
using `150,000,000 ns / median ns per operation`.
CI does not calibrate or adjust counts from observed speed. A new case requires
an explicit count, and changing counts changes the suite hash.

Review counts when changing the case or testbed. Use the raw batch duration
(`ns/op * iterations / 1e6`) to check whether batches remain long enough to
measure and short enough to fit the job budget. Roughly 150 ms per batch is the
initial sizing target, not a pass/fail bound or a claim of steady performance.
Retune deliberately using representative runs; a slow head still executes all
its configured work. Allocation-heavy cases sum bounded timed chunks with explicit
cleanup outside timing. The eight primitive-only control, method and numeric
property cases skip per-batch GC and native frame waits. iOS buffer copies keep
bounded Hermes GC but skip frame waits: collecting their wrappers releases the
owned native storage. Other allocating cases retain GC and native yields. Raw `iterations`, `chunkIterations` and ordered
`samplesNsPerOp` describe the work. Slow samples are retained.

## Reading results

The main score is the median (p50) of all measured batch averages across the four
processes in ns/op, not individual-call tail latency. The report shows every
observed change of at least 5%, including Promise cases. This is a presentation
threshold, not a calibrated regression
budget. Expand the report for the remaining metrics; the raw JSON retains all
samples. Matching pooled medians do not prove
equal performance. Per-pair raw results preserve launch-to-launch variation;
four pairs do not establish a calibrated regression budget or justify treating
eighty batches as independent process runs. Repeat measurement jobs or
same-revision runs to investigate variation.

Performance is currently report-only. Build, execution and malformed-result
failures still fail CI. Turning observed differences into a regression gate needs
empirical validation on unchanged commits and intentional slowdowns on each
unchanged suite/testbed. No Promise case is permanently exempt. Local runs with
the same base and head SHA can measure baseline variation explicitly.
Reports match results by benchmark ID, regardless of suite hashes, case order,
versions, iteration counts or runner settings. New cases show their head timing
as **⭐️ New**; removed cases retain their base timing with **❌ Removed** after.
Changes to a benchmark or measurement method can affect its reported difference;
the PR author interprets those changes. Suite hashes identify source code in
artifacts, rather than deciding which results may be compared.

## Saved apps and measurement reruns

The workflow separates preparation, platform builds, platform measurements and
collection. Each measurement job downloads the immutable app artifact ID produced
by its build job; base and head still run together on one machine. Both revisions
are built even when benchmark definitions change. An identical base/head SHA
reuses the same binary for both sides.
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
There is no new iOS compiler cache. App reuse avoids build work on manual reruns. With 46 cases in each revision, a run
uses 368 fresh processes (184 base + 184 head), while retaining one build and
installation per revision. Balanced order reduces consistent first/second
effects, but same-revision runs are still needed to assess noise on each testbed.

## Artifacts and publishing

The canonical artifact is `performance-report-<attempt>`: raw JSON for every
measured process, plus `performance-report.json` with repository, revisions,
workflow run and attempt provenance, original build metadata and measurement artifact IDs. Artifacts remain available for 30 days.
The PR comment links its exact immutable artifact ID; downloads require GitHub
access. An agent can inspect the JSON instead of scraping the rendered table.

The `nitro-performance` job checks out HEAD and generates the Markdown report and
Bencher Metric Format (BMF) files using that revision's parser and renderer. It
shows the report in the job summary and uploads `performance-publication-<attempt>`
containing `performance-summary.md`, `metadata.json`, and `bencher-*.json`.
The raw artifact is uploaded first so the rendered comment can link its exact ID.
Renderer and raw-schema changes can therefore be reviewed in PR CI before merging.

The isolated request job saves `performance-request-<attempt>` before any PR code
runs. It contains the requested head SHA and workflow identity. The publisher
checks this against the initial commit status written by `github-actions[bot]`
before trusting it. Measurement-only reruns reuse this request; late events from
older attempts cannot overwrite a newer status. Request and publishing jobs share
a concurrency queue per PR to serialize status writes; builds and measurements
remain independent. PR code never receives the bot
key or a token with status/comment write permissions.

One default-branch `Publish Nitro Performance` workflow handles comment-triggered
internal PRs and forks. It selects the exact publication artifact for the triggering
attempt, checks its repository, run, revisions and current PR against GitHub,
and posts its Markdown unchanged. The trusted workflow run name identifies the
triggering PR; the publisher does not choose a PR from artifact-provided data.
It reads no raw samples and never installs or executes PR code or artifact scripts. Comment content is produced by PR code;
provenance checks establish its source, not the correctness of its measurements.
Cancelled and skipped runs skip publication. Build and measurement failures remain
failures. Stale PR results are skipped. User comments are never edited.

The publication envelope is independent of raw app schema versions. Keep its
filenames and identity fields stable when changing benchmarks or report rendering.
Changes to the trusted upload code itself still take effect after merge; ordinary
report changes do not. Raw app results currently use schema version 2.

The trusted workflow also performs the final Bencher upload with `BENCHER_KEY`;
that secret never reaches HEAD code. Its CLI version and binary digest are pinned.
Bencher's JSON adapter validates the already-generated BMF files. The comment is
posted first so an invalid BMF file cannot prevent the report from appearing.
Bencher receives median latency values without invented bounds. PR publications
seed both measured platform baselines at `baseline-<base SHA>` before recording
the head at `pr-<number>`. Automatic main-branch history is no longer recorded.
Bencher receives history only: it does not post a second comment or create alert-driven
checks.

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
creates short-lived installation tokens for the request acknowledgment and report
publication in separate jobs that never execute PR code.

To configure it on `margelo/nitro`:

1. Register a GitHub App named `Nitro Modules Bot` with homepage
   `https://nitro.margelo.com`. Disable webhooks and grant only the repository
   permissions **Pull requests: Read & write** and **Issues: Read & write**
   (Metadata read access is automatic). Issues write access is needed for the 👍
   reaction on a conversation comment. Existing installations must accept this
   additional permission before using the acknowledgment workflow.
   Keep installation restricted to the owning account when the app belongs to
   `margelo`.
2. Upload the NOS image under the app's Display information and install the app
   on only `margelo/nitro`.
3. Generate an app private key and save its PEM contents in the repository's
   Actions secret `NITRO_PERFORMANCE_APP_PRIVATE_KEY`. Keep the key out of git.
4. Set the repository Actions variable `NITRO_PERFORMANCE_APP_CLIENT_ID` to the
   app's Client ID. Set this last, after the key and installation are ready.

The trusted publisher uses the app's actual slug to recognize its own comments.
The acknowledgment job requests both Issues and Pull requests write permissions
so it can react to PR conversation comments. The publisher requests Pull requests
write permission. Both tokens are restricted to the current repository.
The token action revokes each token at the end of its job. Build and measurement jobs never receive the app key. Bencher publishing retains its existing token.
Bot authentication and upload changes take effect after reaching the default branch; report rendering runs from HEAD.

Without the Client ID variable, comments and reactions use `github-actions[bot]`.
Removing that variable switches back to the default identity. Configured app
authentication failures fail the posting job rather than silently switching authors.
Each workflow run creates its own comment under the configured identity. Reruns
update only the matching run's comment from that bot. Switching identities creates
a new comment; earlier comments keep their original author and avatar.

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
