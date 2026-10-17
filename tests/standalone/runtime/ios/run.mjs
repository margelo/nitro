import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const defaults = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url)),
);
const { values } = parseArgs({
  options: {
    os: { type: "string", default: defaults.os },
    device: { type: "string" },
    arch: { type: "string", default: defaults.arch },
    jobs: {
      type: "string",
      default: process.env.NITRO_TEST_JOBS ?? String(defaults.jobs),
    },
    destination: { type: "string", default: process.env.NITRO_IOS_DESTINATION },
    sanitizer: { type: "string", default: "none" },
    "skip-hermes-build": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});
if (values.help) {
  console.log(`Usage: bun tests/standalone/runtime/ios/run.mjs [options]

Defaults live in tests/standalone/runtime/ios/config.json.
  --os VERSION          Simulator OS, e.g. 26 or 26.5 (default: ${defaults.os})
  --device NAME         Exact simulator name (default: ${defaults.device ?? "first available iPhone"})
  --arch ARCH           auto, arm64 or x86_64 (default: ${defaults.arch})
  --jobs N              Parallel build jobs (default: ${defaults.jobs})
  --destination VALUE   Explicit xcodebuild destination, overriding OS/device selection
  --sanitizer MODE      none, address or thread (default: none)
  --skip-hermes-build    Reuse an XCFramework already built for this architecture/toolchain
  -h, --help            Show this help

DEVELOPER_DIR selects Xcode. NITRO_IOS_DESTINATION and NITRO_TEST_JOBS remain supported.`);
  process.exit(0);
}
if (!/^\d+(\.\d+){0,2}$/.test(values.os)) {
  throw new Error("--os must be a version such as 26 or 26.5");
}
if (!["auto", "arm64", "x86_64"].includes(values.arch)) {
  throw new Error("--arch must be auto, arm64 or x86_64");
}
if (!["none", "address", "thread"].includes(values.sanitizer)) {
  throw new Error("--sanitizer must be none, address or thread");
}
const architecture =
  values.arch === "auto"
    ? { arm64: "arm64", x64: "x86_64" }[process.arch]
    : values.arch;
if (!architecture)
  throw new Error(`Unsupported host architecture: ${process.arch}`);
const jobs = Number(values.jobs);
if (!Number.isSafeInteger(jobs) || jobs < 1)
  throw new Error("--jobs must be a positive integer");

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const environment = { ...process.env };
// A single cooperative worker catches native runners that block Swift Tasks
// needed to resolve their JavaScript Promises.
environment.TEST_RUNNER_LIBDISPATCH_COOPERATIVE_POOL_STRICT = "1";
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

let destination = values.destination;
if (!destination) {
  const { devices } = JSON.parse(
    run("xcrun", ["simctl", "list", "devices", "available", "--json"], true),
  );
  const deviceName = values.device ?? defaults.device;
  const runtimes = Object.keys(devices)
    .filter((name) => {
      const version = name.split(".iOS-")[1]?.replaceAll("-", ".");
      return version === values.os || version?.startsWith(`${values.os}.`);
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .reverse();
  const device = runtimes
    .flatMap((runtime) => devices[runtime])
    .find((item) =>
      deviceName ? item.name === deviceName : item.name.startsWith("iPhone"),
    );
  if (!device)
    throw new Error(
      `No available ${deviceName ?? "iPhone"} simulator matches iOS ${values.os}. Install one or select --os, --device or --destination.`,
    );
  destination = `platform=iOS Simulator,id=${device.udid}`;
  // Xcode can start tests while a fresh simulator is still migrating data.
  // Finish booting before starting the test watchdogs.
  run("xcrun", ["simctl", "bootstatus", device.udid, "-b"]);
}
if (values["skip-hermes-build"]) {
  const framework = path.join(
    root,
    "tests/standalone/.build/hermes/NitroTestHermes.xcframework",
  );
  if (!existsSync(path.join(framework, "Info.plist"))) {
    throw new Error(
      "No Hermes XCFramework found. Run without --skip-hermes-build first.",
    );
  }
} else {
  run(process.execPath, [
    "tests/standalone/hermes/build.mjs",
    "ios",
    "--arch",
    architecture,
    "--jobs",
    String(jobs),
    "--deployment-target",
    defaults.deploymentTarget,
  ]);
}
const buildDirectory = path.join(
  root,
  "tests/standalone/.build/ios",
  values.sanitizer,
);
const results = path.join(
  buildDirectory,
  "results",
  `RuntimeTests-${Date.now()}-${process.pid}`,
);
mkdirSync(results, { recursive: true });
if (values.sanitizer !== "none") {
  const option =
    values.sanitizer === "address" ? "ASAN_OPTIONS" : "TSAN_OPTIONS";
  // xcodebuild forwards TEST_RUNNER_ variables to every test process. Preserve
  // Xcode's options, but make a sanitizer finding terminate the test runner.
  environment[`TEST_RUNNER_${option}`] =
    `__CURRENT_VALUE__:halt_on_error=1:abort_on_error=1:log_path=${path.join(results, "sanitizer")}`;
}
const argumentsForTests = [
  "test",
  "-project",
  "tests/standalone/runtime/ios/NitroRuntimeTests.xcodeproj",
  "-scheme",
  "NitroRuntimeTests",
  "-destination",
  destination,
  "-derivedDataPath",
  path.join(buildDirectory, "DerivedData"),
  "-resultBundlePath",
  path.join(results, "RuntimeTests.xcresult"),
  "-enableAddressSanitizer",
  values.sanitizer === "address" ? "YES" : "NO",
  "-enableThreadSanitizer",
  values.sanitizer === "thread" ? "YES" : "NO",
  "-jobs",
  String(jobs),
  "-parallel-testing-enabled",
  "NO",
  "CODE_SIGNING_ALLOWED=NO",
  `ARCHS=${architecture}`,
  `IPHONEOS_DEPLOYMENT_TARGET=${defaults.deploymentTarget}`,
];
const log = openSync(path.join(results, "xcodebuild.log"), "w");
let sanitizerFailure = false;
const diagnostic = /(?:ERROR|WARNING|SUMMARY): (?:Address|Thread)Sanitizer:/;
const outputTails = new Map();
const status = await new Promise((resolve, reject) => {
  const child = spawn("xcodebuild", argumentsForTests, {
    cwd: root,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const [source, target] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    source.on("data", (chunk) => {
      target.write(chunk);
      writeSync(log, chunk);
      const output = (outputTails.get(source) ?? "") + chunk.toString();
      sanitizerFailure ||= diagnostic.test(output);
      outputTails.set(source, output.slice(-256));
    });
  }
  child.once("error", reject);
  child.once("close", (code) => resolve(code ?? 1));
}).finally(() => closeSync(log));
for (const name of readdirSync(results).filter((name) =>
  name.startsWith("sanitizer."),
)) {
  const report = readFileSync(path.join(results, name), "utf8");
  if (report.trim()) {
    process.stderr.write(report);
    sanitizerFailure = true;
  }
}
console.log(`Test results: ${results}`);
if (sanitizerFailure) console.error("Sanitizer reported an error.");
process.exitCode = status || (sanitizerFailure ? 1 : 0);
