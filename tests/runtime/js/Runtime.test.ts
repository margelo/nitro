import { expect } from "chai";
import { getNitroModules } from "nitro-core";
import type { TestObject } from "../specs/TestObject.nitro";

export async function microtasksDrainInOrder(): Promise<void> {
  const completed: number[] = [];
  let chain = Promise.resolve();
  // No native callback wakes the dispatcher. The host must drain these jobs
  // before this test can complete, preserving each iteration's captured index.
  for (let index = 0; index < 300; index++) {
    chain = chain.then(() => {
      expect(completed.length).to.equal(index);
      completed.push(index);
    });
  }
  await chain;
  expect(completed.length).to.equal(300);
}

export async function concurrentNativePromises(): Promise<void> {
  const object = getNitroModules().createHybridObject<TestObject>("TestObject");
  const results = await Promise.all(
    Array.from({ length: 16 }, () => object.calculateFibonacciAsync(10)),
  );
  expect(results).to.deep.equal(Array(16).fill(55n));
  // The same runtime and object remain usable after all completions.
  expect(object.bounceBoolean(true)).to.equal(true);
  expect(await object.calculateFibonacciAsync(1)).to.equal(1n);
}
