import { afterEach, expect, test } from "bun:test";
import { registerTests } from "../js/index";
import {
  casesForTestObjects,
  namedCases,
  withTestTimeout,
} from "../js/utils/cases";

const originalProxy = globalThis.NitroModulesProxy;
const originalRun = globalThis.runNitroTest;
const originalTimeout = globalThis.getNitroTestTimeoutMs;
afterEach(() => {
  globalThis.NitroModulesProxy = originalProxy;
  globalThis.runNitroTest = originalRun;
  globalThis.getNitroTestTimeoutMs = originalTimeout;
});

test("unannotated cases leave the native default unchanged", async () => {
  let called = false;
  registerTests({
    ordinary: () => {
      called = true;
    },
  });
  expect(globalThis.getNitroTestTimeoutMs("ordinary")).toBeUndefined();
  await globalThis.runNitroTest("ordinary");
  expect(called).toBe(true);
});

test("fixture binding preserves timeouts without allocating the fixture", async () => {
  const created: string[] = [];
  const received: string[] = [];
  globalThis.NitroModulesProxy = {
    createHybridObject: (name: string) => {
      created.push(name);
      return { name };
    },
  };
  const cases = casesForTestObjects("Memory", {
    allocate: withTestTimeout(150_000, (object: { name: string }) => {
      received.push(object.name);
    }),
    ordinary: () => {},
  });
  registerTests(cases);

  for (const implementation of ["TestObjectCpp", "TestObjectSwiftKotlin"]) {
    const name = `Memory / ${implementation} / allocate`;
    expect(globalThis.getNitroTestTimeoutMs(name)).toBe(150_000);
    expect(
      globalThis.getNitroTestTimeoutMs(`Memory / ${implementation} / ordinary`),
    ).toBeUndefined();
  }
  expect(created).toEqual([]);
  await globalThis.runNitroTest("Memory / TestObjectCpp / allocate");
  await globalThis.runNitroTest("Memory / TestObjectSwiftKotlin / allocate");
  expect(created).toEqual(["TestObjectCpp", "TestObjectSwiftKotlin"]);
  expect(received).toEqual(created);
});

test("named cases retain an explicit timeout", () => {
  registerTests(
    namedCases("Stress", { allocate: withTestTimeout(500, () => {}) }),
  );
  expect(globalThis.getNitroTestTimeoutMs("Stress / allocate")).toBe(500);
});

test("timeout lookup rejects unknown and inherited case names", () => {
  registerTests({ ordinary: () => {} });
  for (const name of ["missing", "constructor"]) {
    expect(() => globalThis.getNitroTestTimeoutMs(name)).toThrow(
      `Unknown Nitro test: ${name}`,
    );
  }
});

test("only the four allocation stress cases receive a longer budget", async () => {
  globalThis.NitroModulesProxy = {};
  const { cases } = await import("../js/memory.test");
  registerTests(cases);
  const overrides = Object.keys(cases).filter(
    (name) => globalThis.getNitroTestTimeoutMs(name) !== undefined,
  );
  expect(overrides.sort()).toEqual([
    "Memory / TestObjectCpp / newTestObject() objects are reclaimed by JS GC",
    "Memory / TestObjectCpp / newTestObject() objects are released by manual dispose()",
    "Memory / TestObjectSwiftKotlin / newTestObject() objects are reclaimed by JS GC",
    "Memory / TestObjectSwiftKotlin / newTestObject() objects are released by manual dispose()",
  ]);
  for (const name of overrides) {
    expect(globalThis.getNitroTestTimeoutMs(name)).toBe(150_000);
  }
});
