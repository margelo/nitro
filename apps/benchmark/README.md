# Nitro benchmark app

A dedicated Release/Hermes app for measuring JS ↔ native boundary performance.
It uses the real C++, Swift/Kotlin, and generated bindings from the Nitro test
packages. It has no Harness or navigation dependencies. Correctness tests and
demos remain in `apps/example`.

The suite runs automatically when a host receiver is present. Launching the app
alone reports a controller connection error; it does not silently substitute a
Debug benchmark or publish anything to Bencher.

## Build

From the repository root:

```sh
bun install --frozen-lockfile
bun benchmark build:android

bun benchmark bundle-install
bun benchmark pods
bun benchmark build:ios
```

Both platforms use the normal `Release` configuration, an embedded optimized
Hermes bundle, and no debugger or sanitizers. Android enables R8 and uses the
development signing key because this app is not distributed. Its network policy
permits cleartext only to `127.0.0.1` and `localhost` for the host receiver.

## Run locally

For an already booted Android API 36 emulator, after building the APK:

```sh
bun scripts/performance/run-device.ts \
  --platform android \
  --app apps/benchmark/android/app/build/outputs/apk/release/app-release.apk \
  --output /tmp/nitro-benchmark.json \
  --device-id "$(adb get-serialno)" \
  --run-id android-local-1 \
  --reverse false \
  --commit-sha "$(git rev-parse HEAD)" \
  --suite-hash "$(bun scripts/performance/suite-hash.ts .)" \
  --device 'Local emulator' \
  --os-version 'Android 16 / API 36' \
  --architecture x86_64 \
  --toolchain 'Local JDK 17 / NDK 29.0.14206865'
```

Adjust device metadata to match the target. The host starts the receiver,
installs and launches the app, validates the result, and terminates the app.
The host installs each binary once, then launches a fresh process for each case
and assembles their results. This releases Nitro's runtime-scoped JSI reference
bookkeeping between cases; GC alone cannot clear that cache. Each process posts
one result only after its timing is complete. Per-case raw results are kept beside
the combined output in a `*-cases/` directory. Reversing the suite reverses the
case launch order too. Startup, transport, and process restarts are not timed.
For iOS, use `--platform ios`, a simulator UDID for `--device-id`, and the built
`NitroBenchmark.app` for `--app`, with matching simulator/toolchain metadata.
Local runs do not upload results.

Each metric targets 150 ms of timed work per sample (roughly
100–200 ms), using round iteration counts with two significant digits, such as
1,500,000 or 24,000. Calibration can grow or shrink the count and is rechecked
after five warmup batches. That count is then frozen for twenty measured samples;
slow samples are retained, not discarded or adaptively shortened.

Allocation-heavy cases split a sample into bounded chunks, collecting garbage
after each chunk and yielding for native cleanup at most every four chunks,
outside the timer. Kotlin buffer-copy and Promise cases also collect Java's heap
between chunks through a synchronous, benchmark-only TurboModule helper; Hermes
GC alone cannot reclaim Java-backed direct buffers. Cleanup is excluded from
timing. Each sample divides its accumulated timed duration by
the total operation count; the memory limit no longer caps the sample duration.
Hermes `gc()` is required, and calibration fails rather than accepting a tiny
cap-limited batch. Raw results include `iterations` and `chunkIterations`; each
sample's total timed milliseconds is `samplesNsPerOp[i] * iterations / 1e6`.
These are operation-cost measurements with explicit inter-chunk cleanup excluded,
not sustained allocation/GC throughput. Natural GC during an operation is timed.
The measured cost includes the operation, marshaling, and JS loop bookkeeping.
Input setup, checksum validation, logging, statistics, and transport are outside
the timed batch. Operation-induced allocations remain inside it.

## CI and reporting

See [performance CI](../../.github/PERFORMANCE.md) for observed comparisons,
process variability, raw artifacts, trusted reporting, and Bencher publishing.
Base and head are built independently. Same-revision scheduled/manual runs show
baseline variation. Performance remains report-only.

The example's former benchmark screen and TurboModule control have moved here.
No public Nitro API changes are needed. App dependency versions initially match
the example; automated version-alignment enforcement is a separate follow-up.
