import { expect } from "chai";
import { getNitroModules } from "nitro-core";
import type { TestObject } from "../specs/TestObject.nitro";

function createTestObject(): TestObject {
  return getNitroModules().createHybridObject<TestObject>("TestObject");
}

export function booleans(): void {
  const object = createTestObject();
  expect(object.bounceBoolean(true)).to.equal(true);
  expect(object.bounceBoolean(false)).to.equal(false);
}

export async function fibonacci(): Promise<void> {
  const object = createTestObject();
  expect(await object.calculateFibonacciAsync(0)).to.equal(0n);
  expect(await object.calculateFibonacciAsync(1)).to.equal(1n);
  expect(await object.calculateFibonacciAsync(10)).to.equal(55n);
  // A value beyond Number.MAX_SAFE_INTEGER checks the native Int64/Long path.
  expect(await object.calculateFibonacciAsync(79)).to.equal(14472334024676221n);
}

export async function rejectedFibonacci(): Promise<void> {
  const object = createTestObject();
  let rejection: unknown;
  try {
    await object.calculateFibonacciAsync(-1);
  } catch (error) {
    rejection = error;
  }
  expect(rejection).to.be.instanceOf(Error);
  expect((rejection as Error).message).to.include(
    "Fibonacci input must be an integer between 0 and 92",
  );
}
