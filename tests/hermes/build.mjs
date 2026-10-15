import { mkdirSync } from "node:fs";
import { availableParallelism, arch, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const tests = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(tests, "vendor/hermes");
const options = resolve(tests, "hermes/options.cmake");
const output = resolve(tests, ".build/hermes");
const { values, positionals } = parseArgs({
  options: {
    arch: { type: "string", default: arch() === "arm64" ? "arm64" : "x86_64" },
    jobs: {
      type: "string",
      default: String(Math.min(availableParallelism(), 4)),
    },
  },
  allowPositionals: true,
});
const [target] = positionals;
const architecture = values.arch;
const jobs = Number(values.jobs);
if (positionals.length !== 1 || !["host", "ios"].includes(target)) {
  throw new Error(
    "Usage: node tests/hermes/build.mjs host|ios [--arch arm64|x86_64] [--jobs N]",
  );
}
if (!["arm64", "x86_64"].includes(architecture)) {
  throw new Error(`Unsupported simulator architecture: ${architecture}`);
}
if (!Number.isSafeInteger(jobs) || jobs < 1) {
  throw new Error("--jobs must be a positive integer");
}
if (target === "ios" && platform() !== "darwin") {
  throw new Error("iOS builds require macOS and Xcode");
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status ?? result.signal})`);
  }
}

const host = resolve(output, "host");
run("cmake", [
  "-C",
  options,
  "-S",
  source,
  "-B",
  host,
  "-G",
  "Ninja",
  "-DCMAKE_BUILD_TYPE=Release",
  "-DHERMES_ENABLE_TOOLS=ON",
  "-DHERMES_UNICODE_LITE=ON",
]);
run("cmake", [
  "--build",
  host,
  "--target",
  "hermesc",
  "--parallel",
  String(jobs),
]);

if (target === "ios") {
  const build = resolve(output, `ios-simulator-${architecture}`);
  run("cmake", [
    "-C",
    options,
    "-S",
    source,
    "-B",
    build,
    "-G",
    "Ninja",
    "-DCMAKE_BUILD_TYPE=Debug",
    "-DCMAKE_SYSTEM_NAME=iOS",
    "-DHERMES_APPLE_TARGET_PLATFORM=iphonesimulator",
    "-DCMAKE_OSX_SYSROOT=iphonesimulator",
    `-DCMAKE_OSX_ARCHITECTURES=${architecture}`,
    "-DCMAKE_OSX_DEPLOYMENT_TARGET=16.0",
    `-DIMPORT_HOST_COMPILERS=${resolve(host, "ImportHostCompilers.cmake")}`,
  ]);
  run("cmake", [
    "--build",
    build,
    "--target",
    "hermesvm_a",
    "jsi",
    "--parallel",
    String(jobs),
  ]);
  mkdirSync(resolve(build, "lib"), { recursive: true });
  run("xcrun", [
    "libtool",
    "-static",
    "-o",
    resolve(build, "lib/libNitroTestHermes.a"),
    resolve(build, "lib/libhermesvm_a.a"),
    resolve(build, "jsi/libjsi.a"),
  ]);
}
