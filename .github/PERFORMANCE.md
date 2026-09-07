# Release performance CI

`Nitro Performance` builds `apps/benchmark` in its ordinary Release/Hermes configuration,
then runs base → head → head → base on one booted target. A noisy comparison can
run one additional head/base pair. Each suite measures 40 cases with five warmup
batches and twenty samples, calibrated toward 150 ms (roughly 100–200 ms) of
timed work per sample. Iteration counts are rounded to two significant digits
and frozen after warmup; measured outliers are retained. Allocation-heavy samples
sum bounded timed chunks with explicit GC and native-cleanup yields between chunks excluded from timing,
so memory-safety limits do not shorten the sample. See `iterations` and
`chunkIterations` in raw results; sample milliseconds are `ns/op * iterations / 1e6`.
Calibration changes and version-2 benchmark definitions require a new baseline.
Each binary is installed once per suite run. Each case uses a fresh app process
so the runtime-scoped JSI reference cache does not accumulate millions of weak
reference records across unrelated cases. Startup is outside measured work;
the host validates and combines the per-case results, preserving their raw samples.
The host computes confidence intervals by resampling whole matched base/head
process runs, then batches within each selected run. Bencher median bounds use
the same run-aware approach. Treating all batches from multiple processes as
independent gave a false-positive control result in the initial A/A validation;
process-level variability must be preserved in the uncertainty estimate.
Robust CV remains visible and causes a neutral result when uncertainty overlaps
zero. It is not an unconditional veto: an effect beyond the budget whose full
run-aware confidence interval excludes zero is still reported in its direction.

The benchmark app is separate from `apps/example`, which keeps the demos and
Harness correctness tests. It shares the real Nitro test packages, but has no
Harness, navigation, screens, or safe-area dependencies. The TurboModule control
and all benchmark cases belong to the benchmark app. Android permits
cleartext only to loopback; the example app does not contain the CI entrypoint.
See [`apps/benchmark/README.md`](../apps/benchmark/README.md) for local commands.

## Android host requirements

The API 36 x86_64 emulator **must use KVM CPU acceleration**. The workflow grants
the ephemeral runner access to `/dev/kvm`, verifies acceleration before boot, and
launches with `-accel on`. Missing acceleration fails the job rather than silently
falling back to software CPU emulation. Software GPU rendering is separate and is
still used on the headless runner.

The initial bootstrap run accidentally used `-accel off`: boot alone took 8½
minutes and six suites took another 32½ minutes. Those Android timings are not a
performance baseline. Accelerated results use a distinct `...-kvm` Bencher testbed.

Host-side log lines show each suite's start, completion, measurement duration,
total wall time (including app installation/launch), and why a repeat pair ran.
These logs are outside the app's timed regions. Raw JSON, BMF, and comparison
Markdown are retained in the workflow artifacts for 30 days.
Both targets have a five-minute boot limit; individual device installation and
launch commands have a two-minute limit. Android app exits also retain logcat and
process-exit diagnostics, so native crashes do not disappear at emulator teardown.

Same-repository PRs publish from a separate clean job after both device jobs
finish. This works before merge: it checks out an immutable, reviewed reporting
commit, downloads only result data, validates it against GitHub API metadata,
and rebuilds the table/BMF without installing or executing either app checkout.
Fork PRs never enter this privileged job; their `workflow_run` reporter becomes
active once its definition reaches the default branch. That reporter skips
same-repository PRs to avoid duplicate uploads. Both paths post the rebuilt
paired-comparison table as one updatable PR comment, independently of Bencher's
historical comparison. Stale results do
not overwrite a newer PR revision, and user-authored comments are never edited.
Revoke the previously exposed credential and replace the
repository's `BENCHER_KEY` secret before enabling publishing. PR jobs never receive
that secret in device/build jobs or any fork job. After rotation, set the repository variable `NITRO_BENCHER_ENABLED`
to `true` to enable Bencher uploads. The paired PR comment does not need that key.
Verdicts remain advisory during noise calibration.

The pre-merge publisher requires a real base benchmark app. The infrastructure
PR's bootstrap A/A runs remain diagnostic artifacts, not Bencher baselines.
For paired PR reports, first upload the measured base to `baseline-<full-base-sha>`
on each testbed, then upload `pr-<number>` with that exact baseline as its start
point. This works with an empty Bencher project and with stacked PRs without
pretending their base is `main`. Pushes/scheduled main runs record main history.
Both platform baselines are uploaded before either head. The publisher does not
reset the PR branch for each platform, preserving the other testbed's reports;
a changed base SHA naturally selects a different start point.
The Bencher action and downloaded CLI version are both pinned. Both publishers
verify the reviewed Linux CLI SHA-256 before the step receiving the API key.

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

Both publishing paths use the app's actual slug to recognize their own comments.
They request only Pull requests write permission for the current repository, and
the token action revokes the token at the end of the job. Build jobs and fork PR
jobs never receive the app key. Bencher publishing retains its existing token.
Update the same-repository publisher's reporting commit pin when changing the
reporter. Fork reporting changes take effect after reaching the default branch.

Without the Client ID variable, comments continue as `github-actions[bot]`.
Removing that variable switches back to the default identity. Configured app
authentication failures fail the posting job rather than silently switching authors.
The first run after switching identities creates a new comment; subsequent runs
update that bot's comment. Earlier comments keep their original author and avatar.

## Promoting performance verdicts to a gate

This initial workflow always passes `--mode advisory`; merging it does **not**
enable performance enforcement. Collect at least 30 successful main/no-change
runs on each unchanged suite and testbed before a separate reviewed promotion.
Use only same-commit comparisons to estimate noise; ordinary base/head deltas
may include real code changes and must not inflate the noise allowance.

For each synchronous case, the promotion must set a per-case budget of
`max(5%, 1.5 × p95(abs(no-change delta)))`. Cases requiring over 10%, Promise
metrics, and inconclusive comparisons remain advisory. The current 5% table
threshold is provisional, not a calibrated gate. Do not simply change `--mode`
to `enforce`: the initial comparator uses that single provisional threshold, and
the trusted reporter deliberately rejects PR attempts to enable enforcement.
Promotion needs the reviewed per-case policy and matching reporter support.
