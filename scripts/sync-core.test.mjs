import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { syncCore } from "./sync-core.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "nitro-staging-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (file, text) => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(
      target,
      typeof text === "object" ? JSON.stringify(text) : text,
    );
  };
  put("package.json", { private: true });
  put("packages/react-native-nitro-modules/package.json", {
    version: "1.2.3",
    dependencies: { "nitro-core": "1.2.3" },
  });
  put("packages/nitro-core/package.json", {
    name: "nitro-core",
    version: "1.2.3",
  });
  put("packages/nitrogen/package.json", {
    name: "nitrogen",
    version: "1.2.3",
    dependencies: { "nitro-core": "^1.2.3" },
  });
  put(
    "packages/nitro-core/js/src/version.ts",
    "export const version = '1.2.3'\n",
  );
  put(
    "packages/nitro-core/native/cpp/utils/NitroDefines.hpp",
    '#define NITRO_VERSION "1.2.3"\n',
  );
  put(
    "packages/nitro-core/native/apple/HybridObject.swift",
    "// Swift source\n",
  );
  put(
    "packages/nitro-core/native/android/src/main/HybridObject.kt",
    "// Kotlin source\n",
  );
  put(
    "packages/nitro-core/native/android/src/main/res/values/ids.xml",
    "<resources/>\n",
  );
  put("packages/nitro-core/LICENSE", "MIT\n");
  return {
    root,
    put,
    wrapper: path.join(root, "packages/react-native-nitro-modules"),
  };
}

test("stages workspace sources without dependencies and cleans only generated directories", (t) => {
  const { root, put, wrapper } = fixture(t);
  put(
    "packages/react-native-nitro-modules/android/core/obsolete.kt",
    "// stale",
  );
  put(
    "packages/react-native-nitro-modules/android/build.gradle",
    "// handwritten",
  );
  put("packages/react-native-nitro-modules/src/index.ts", "// RN integration");
  const adapters = [
    "cpp/views/HybridView.hpp",
    "ios/views/HybridView.swift",
    "android/src/main/java/NitroModules.kt",
  ];
  for (const file of adapters)
    put(`packages/react-native-nitro-modules/${file}`, "// RN adapter");
  put("packages/nitro-core/native/cpp/cache.o", "build cache");
  assert.deepEqual(syncCore(root), { version: "1.2.3", files: 5 });
  assert.equal(
    readFileSync(path.join(wrapper, "ios/core/HybridObject.swift"), "utf8"),
    "// Swift source\n",
  );
  assert.equal(
    readFileSync(path.join(wrapper, "android/build.gradle"), "utf8"),
    "// handwritten",
  );
  assert.equal(
    readFileSync(path.join(wrapper, "src/index.ts"), "utf8"),
    "// RN integration",
  );
  assert.equal(
    existsSync(path.join(wrapper, "android/core/obsolete.kt")),
    false,
  );
  assert.equal(existsSync(path.join(wrapper, "cpp/core/cache.o")), false);
  assert.doesNotThrow(() => syncCore(root, { check: true }));
  for (const file of adapters)
    assert.equal(readFileSync(path.join(wrapper, file), "utf8"), "// RN adapter");
  put("packages/react-native-nitro-modules/cpp/core/stale.hpp", "// stale");
  assert.throws(() => syncCore(root, { check: true }), /stale/);
  syncCore(root);
  put(
    "packages/react-native-nitro-modules/ios/core/HybridObject.swift",
    "// independently changed",
  );
  assert.throws(() => syncCore(root, { check: true }), /differs/);
});

test("rejects a version mismatch before cleaning staged sources", (t) => {
  const { root, put, wrapper } = fixture(t);
  put("packages/react-native-nitro-modules/cpp/core/preserve.hpp", "// keep");
  put(
    "packages/nitro-core/js/src/version.ts",
    "export const version = '1.2.4'\n",
  );
  assert.throws(() => syncCore(root), /must match/);
  assert.equal(
    readFileSync(path.join(wrapper, "cpp/core/preserve.hpp"), "utf8"),
    "// keep",
  );
});

test("uses workspace changes even when an older core package is installed", (t) => {
  const { root, put, wrapper } = fixture(t);
  put("node_modules/nitro-core/package.json", {
    name: "nitro-core",
    version: "1.2.2",
  });
  put("node_modules/nitro-core/native/apple/HybridObject.swift", "// old source\n");
  syncCore(root);
  put("packages/nitro-core/native/apple/HybridObject.swift", "// edited source\n");
  assert.throws(() => syncCore(root, { check: true }), /differs/);
  syncCore(root);
  assert.equal(
    readFileSync(path.join(wrapper, "ios/core/HybridObject.swift"), "utf8"),
    "// edited source\n",
  );
});

test("rejects unpinned dependencies and native source symlinks before cleaning", (t) => {
  const { root, put, wrapper } = fixture(t);
  put("packages/react-native-nitro-modules/cpp/core/preserve.hpp", "// keep");
  put("packages/react-native-nitro-modules/package.json", {
    version: "1.2.3",
    dependencies: { "nitro-core": "^1.2.3" },
  });
  assert.throws(() => syncCore(root), /pin nitro-core/);
  put("packages/react-native-nitro-modules/package.json", {
    version: "1.2.3",
    dependencies: { "nitro-core": "1.2.3" },
  });
  symlinkSync(
    path.join(root, "package.json"),
    path.join(root, "packages/nitro-core/native/cpp/outside.hpp"),
  );
  assert.throws(() => syncCore(root), /symlink/);
  assert.equal(
    readFileSync(path.join(wrapper, "cpp/core/preserve.hpp"), "utf8"),
    "// keep",
  );
});


test("migrates the old staging layout without duplicating Core or deleting RN adapters", (t) => {
  const { root, put, wrapper } = fixture(t);
  const legacy = [
    "cpp/utils/NitroDefines.hpp",
    "ios/HybridObject.swift",
    "android/src/main/HybridObject.kt",
  ];
  for (const file of legacy)
    put(`packages/react-native-nitro-modules/${file}`, "// previous generated source");
  put("packages/react-native-nitro-modules/ios/turbomodule/NativeNitroModules.mm", "// RN adapter");
  assert.throws(() => syncCore(root, { check: true }), /Legacy staged/);
  syncCore(root);
  for (const file of legacy) assert.equal(existsSync(path.join(wrapper, file)), false);
  assert.equal(readFileSync(path.join(wrapper, "ios/turbomodule/NativeNitroModules.mm"), "utf8"), "// RN adapter");
  assert.doesNotThrow(() => syncCore(root, { check: true }));
});
