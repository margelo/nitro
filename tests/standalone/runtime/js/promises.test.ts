import { expect } from "chai";
import {
  casesForTestObjects,
  delay,
  rejection,
  settledWithin,
  STILL_PENDING,
  withTimeout,
} from "./utils/cases";

import { type Car } from "../specs/TestObject.nitro";

import { TEST_CAR, TEST_CAR_2 } from "./utils/fixtures";
import { deferred } from "./utils/helpers";

/** A JS reference implementation of `calculateFibonacciSync(n)`. */
function fibonacci(n: number): bigint {
  let current = 0n;
  let next = 1n;
  for (let i = 0; i < n; i++) {
    [current, next] = [next, current + next];
  }
  return current;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches `prefix` followed by exactly `message`. Kotlin exceptions reach JS
 * through fbjni as `<java class>: <message>` followed by `\n\tat ...` stack
 * lines, so an optional class name and trailing lines are allowed.
 */
function exactNativeMessage(prefix: string, message: string): RegExp {
  return new RegExp(
    `^${escapeRegExp(prefix)}(?:[\\w.$]+: )?${escapeRegExp(message)}(?:\\n|$)`,
  );
}

/** Matches the message of a rejected native Promise (no method prefix). */
function rejectionMessage(message: string): RegExp {
  return exactNativeMessage("", message);
}

/** Matches the message of a synchronous throw from `<object>.<method>(...)`. */
function nativeErrorMessage(
  objectName: string,
  method: string,
  message: string,
): RegExp {
  return exactNativeMessage(`${objectName}.${method}(...): `, message);
}
export const cases = {
  ...casesForTestObjects("Promises", {
    "wait(0.1) resolves": async (testObject) => {
      await expect(await testObject.wait(0.1)).to.equal(undefined);
    },

    "calculateFibonacciSync(10) returns 55n": (testObject) => {
      expect(Object.is(testObject.calculateFibonacciSync(10), 55n)).to.equal(
        true,
      );
    },

    "calculateFibonacciAsync(10) resolves to 55n": async (testObject) => {
      await expect(
        Object.is(await testObject.calculateFibonacciAsync(10), 55n),
      ).to.equal(true);
    },

    "promiseThrows() rejects": async (testObject) => {
      // Native rejects the returned Promise instead of throwing synchronously.
      const promise = testObject.promiseThrows();
      expect(promise).to.be.instanceOf(Promise);
      await expect(await rejection(promise)).to.be.instanceOf(Error);
      await expect(await rejection(promise))
        .to.be.instanceOf(Error)
        .and.have.property("message")
        .that.match(rejectionMessage("Promise throws :)"));
    },

    "promiseReturnsInstantly() resolves to 55": async (testObject) => {
      await expect(
        Object.is(await testObject.promiseReturnsInstantly(), 55),
      ).to.equal(true);
    },

    "promiseReturnsInstantlyAsync() resolves to 55": async (testObject) => {
      await expect(
        Object.is(await testObject.promiseReturnsInstantlyAsync(), 55),
      ).to.equal(true);
    },

    "promiseReturnsInstantlyAsync() resolves 100 parallel calls": async (
      testObject,
    ) => {
      const results = await Promise.all(
        Array.from({ length: 100 }, () =>
          testObject.promiseReturnsInstantlyAsync(),
        ),
      );
      expect(results).to.deep.equal(Array(100).fill(55));
    },

    "promiseThatResolvesVoidInstantly() resolves to undefined": async (
      testObject,
    ) => {
      await expect(
        await testObject.promiseThatResolvesVoidInstantly(),
      ).to.equal(undefined);
    },

    "promiseThatResolvesToUndefined() resolves to undefined": async (
      testObject,
    ) => {
      await expect(await testObject.promiseThatResolvesToUndefined()).to.equal(
        undefined,
      );
    },

    "awaitNullablePromise() resolves to undefined": async (testObject) => {
      await expect(await testObject.awaitNullablePromise()).to.equal(undefined);
    },

    "wait(0.5) twice runs in parallel": async (testObject) => {
      const start = Date.now();
      // 0.5s + 0.5s = ~1s in serial, ~0.5s in parallel
      await Promise.all([testObject.wait(0.5), testObject.wait(0.5)]);
      const duration = Date.now() - start;
      expect(duration, "ms for two parallel wait(0.5) calls").to.be.lessThan(
        1000,
      );
    },

    "calculateFibonacciAsync(0) resolves to 0n": async (testObject) => {
      await expect(
        Object.is(await testObject.calculateFibonacciAsync(0), 0n),
      ).to.equal(true);
    },

    "calculateFibonacciAsync(1) resolves to 1n": async (testObject) => {
      await expect(
        Object.is(await testObject.calculateFibonacciAsync(1), 1n),
      ).to.equal(true);
    },

    "calculateFibonacciAsync(...) resolves 50 parallel calls with their own results":
      async (testObject) => {
        // The C++ implementation is recursive, so keep `n` small.
        const inputs = Array.from({ length: 50 }, (_, i) => i % 25);
        const results = await Promise.all(
          inputs.map((n) => testObject.calculateFibonacciAsync(n)),
        );
        expect(results).to.deep.equal(inputs.map(fibonacci));
      },

    "wait(...) does not block the JS thread": async (testObject) => {
      // Kotlin truncates the seconds to a whole number, so wait at least 1s.
      const waited = testObject.wait(1).then(() => "wait finished");
      await expect(
        Object.is(
          await Promise.race([waited, delay(20, "JS timer fired")]),
          "JS timer fired",
        ),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("Pending native Promises", {
    // Each TestObject only has one pending Promise slot, so every test uses its
    // own TestObject to not leak a pending Promise into the next test.

    "createPendingPromise() stays pending until it is triggered": async (
      testObject,
    ) => {
      const object = testObject.newTestObject();
      const promise = object.createPendingPromise();
      try {
        await expect(
          Object.is(await settledWithin(promise), STILL_PENDING),
        ).to.equal(true);
      } finally {
        object.resolvePendingPromiseOnWorker();
      }
    },

    "resolvePendingPromiseOnWorker() resolves the pending Promise to 55":
      async (testObject) => {
        const object = testObject.newTestObject();
        const promise = object.createPendingPromise();
        object.resolvePendingPromiseOnWorker();
        await expect(Object.is(await withTimeout(promise), 55)).to.equal(true);
      },

    "createPendingPromise() throws while another Promise is pending": async (
      testObject,
    ) => {
      const object = testObject.newTestObject();
      const first = object.createPendingPromise();
      try {
        expect(() => object.createPendingPromise()).to.throw(
          nativeErrorMessage(
            testObject.name,
            "createPendingPromise",
            "A pending Promise is already waiting for completion.",
          ),
        );
      } finally {
        object.resolvePendingPromiseOnWorker();
      }
      await expect(Object.is(await withTimeout(first), 55)).to.equal(true);
    },

    "resolvePendingPromiseOnWorker() throws without a pending Promise": (
      testObject,
    ) => {
      const object = testObject.newTestObject();
      expect(() => object.resolvePendingPromiseOnWorker()).to.throw(
        nativeErrorMessage(
          testObject.name,
          "resolvePendingPromiseOnWorker",
          "No pending Promise is waiting for completion.",
        ),
      );
    },

    "createPendingPromise() works again after the previous Promise resolved":
      async (testObject) => {
        const object = testObject.newTestObject();
        const first = object.createPendingPromise();
        object.resolvePendingPromiseOnWorker();
        await expect(Object.is(await withTimeout(first), 55)).to.equal(true);

        const second = object.createPendingPromise();
        object.resolvePendingPromiseOnWorker();
        await expect(Object.is(await withTimeout(second), 55)).to.equal(true);
      },

    "createPendingPromise() has a separate pending slot per TestObject": async (
      testObject,
    ) => {
      const first = testObject.newTestObject();
      const second = testObject.newTestObject();
      const firstPromise = first.createPendingPromise();
      const secondPromise = second.createPendingPromise();
      first.resolvePendingPromiseOnWorker();
      second.resolvePendingPromiseOnWorker();
      await expect(
        await withTimeout(Promise.all([firstPromise, secondPromise])),
      ).to.deep.equal([55, 55]);
    },
  }),
  ...casesForTestObjects("JS Promises awaited on native", {
    "awaitAndGetPromise(...) resolves to the JS number": async (testObject) => {
      const jsPromise = deferred<number>();
      const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise);
      jsPromise.resolve(5);
      await expect(Object.is(await withTimeout(nativePromise), 5)).to.equal(
        true,
      );
    },

    "awaitAndGetComplexPromise(...) resolves to the JS Car": async (
      testObject,
    ) => {
      const jsPromise = deferred<Car>();
      const nativePromise = testObject.awaitAndGetComplexPromise(
        jsPromise.promise,
      );
      jsPromise.resolve(TEST_CAR);
      await expect(await withTimeout(nativePromise)).to.deep.equal(TEST_CAR);
    },

    "awaitPromise(...) resolves when the JS Promise resolves": async (
      testObject,
    ) => {
      const jsPromise = deferred<void>();
      const nativePromise = testObject.awaitPromise(jsPromise.promise);
      jsPromise.resolve();
      await expect(await withTimeout(nativePromise)).to.equal(undefined);
    },

    "awaitPromise(...) rejects when the JS Promise rejects": async (
      testObject,
    ) => {
      const jsPromise = deferred<void>();
      const nativePromise = testObject.awaitPromise(jsPromise.promise);
      jsPromise.reject(new Error("rejected from JS!"));
      await expect(await rejection(withTimeout(nativePromise)))
        .to.be.instanceOf(Error)
        .and.have.property("message")
        .that.include("rejected from JS!");
    },

    "awaitAndGetPromise(...) stays pending while the JS Promise is pending":
      async (testObject) => {
        const jsPromise = deferred<number>();
        const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise);
        try {
          await expect(
            Object.is(await settledWithin(nativePromise), STILL_PENDING),
          ).to.equal(true);
        } finally {
          jsPromise.resolve(0);
        }
      },

    "awaitAndGetPromise(...) resolves an already resolved JS Promise": async (
      testObject,
    ) => {
      await expect(
        Object.is(
          await withTimeout(testObject.awaitAndGetPromise(Promise.resolve(42))),
          42,
        ),
      ).to.equal(true);
    },

    'awaitAndGetPromise(...) rejects with "<name>: <message>" of the JS error':
      async (testObject) => {
        const jsPromise = deferred<number>();
        const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise);
        jsPromise.reject(new Error("rejected from JS!"));
        await expect(await rejection(withTimeout(nativePromise)))
          .to.be.instanceOf(Error)
          .and.have.property("message")
          .that.match(rejectionMessage("Error: rejected from JS!"));
      },

    "awaitAndGetComplexPromise(...) rejects when the JS Promise rejects":
      async (testObject) => {
        const jsPromise = deferred<Car>();
        const nativePromise = testObject.awaitAndGetComplexPromise(
          jsPromise.promise,
        );
        jsPromise.reject(new Error("no car from JS!"));
        await expect(await rejection(withTimeout(nativePromise)))
          .to.be.instanceOf(Error)
          .and.have.property("message")
          .that.include("Error: no car from JS!");
      },

    "awaitPromise(...) rejection keeps the name of a TypeError": async (
      testObject,
    ) => {
      const jsPromise = deferred<void>();
      const nativePromise = testObject.awaitPromise(jsPromise.promise);
      jsPromise.reject(new TypeError("wrong type from JS!"));
      await expect(await rejection(withTimeout(nativePromise)))
        .to.be.instanceOf(Error)
        .and.have.property("message")
        .that.include("TypeError: wrong type from JS!");
    },

    "awaitAndGetComplexPromise(...) keeps every optional Car field": async (
      testObject,
    ) => {
      await expect(
        await withTimeout(
          testObject.awaitAndGetComplexPromise(Promise.resolve(TEST_CAR_2)),
        ),
      ).to.deep.equal(TEST_CAR_2);
    },

    "awaitAndGetPromise(...) resolves 50 parallel JS Promises with their own values":
      async (testObject) => {
        const jsPromises = Array.from({ length: 50 }, () => deferred<number>());
        const nativePromises = jsPromises.map((jsPromise) =>
          testObject.awaitAndGetPromise(jsPromise.promise),
        );
        // Settle them in reverse order, so results can't line up by accident.
        for (let i = jsPromises.length - 1; i >= 0; i--) {
          jsPromises[i]!.resolve(i * 1.5);
        }
        await expect(
          await withTimeout(Promise.all(nativePromises)),
        ).to.deep.equal(jsPromises.map((_, i) => i * 1.5));
      },

    "awaitPromise(...) throws synchronously for a non-Promise argument": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error intentionally passing a number instead of a Promise
        testObject.awaitPromise(5),
      ).to.throw(`${testObject.name}.awaitPromise(...): `);
    },
  }),
};
