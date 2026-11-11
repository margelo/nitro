import { expect } from "chai";
import {
  casesForTestObjects,
  delay,
  recordCallback,
  rejection,
  waitFor,
  withTimeout,
} from "./utils/cases";

// Nitro calls void and Promise-returning JS callbacks asynchronously (through
// the JS dispatcher), so a spy passed to native is only called some time
// after the native method returned.
const CALLBACK_TIMEOUT = { timeout: 2000 };

// `createArrayBuffer()` allocates 10 MB on every platform.
const CREATED_ARRAY_BUFFER_SIZE = 1024 * 1024 * 10;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches exactly `text`, not just a substring of the error message. */
function exactly(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}$`);
}
export const cases = {
  ...casesForTestObjects("Callbacks", {
    "callCallback(...) calls the callback once without arguments": async (
      testObject,
    ) => {
      const callback = recordCallback();
      testObject.callCallback(callback);
      await waitFor(
        () => expect(callback.calls).to.have.length(1),
        CALLBACK_TIMEOUT,
      );
      expect(callback.calls).to.deep.include([]);
    },

    "callWithOptional(undefined) calls back with undefined": async (
      testObject,
    ) => {
      const callback = recordCallback();
      testObject.callWithOptional(undefined, callback);
      await waitFor(
        () => expect(callback.calls).to.deep.include([undefined]),
        CALLBACK_TIMEOUT,
      );
    },

    "callWithOptional(433) calls back with 433": async (testObject) => {
      const callback = recordCallback();
      testObject.callWithOptional(433, callback);
      await waitFor(
        () => expect(callback.calls).to.deep.include([433]),
        CALLBACK_TIMEOUT,
      );
    },

    "getValueFromJsCallback(...) passes the JS value to the second callback":
      async (testObject) => {
        const andThenCall = recordCallback();
        await withTimeout(
          testObject.getValueFromJsCallback(() => "hello", andThenCall),
        );
        await waitFor(
          () => expect(andThenCall.calls).to.deep.include(["hello"]),
          CALLBACK_TIMEOUT,
        );
      },

    "callCallbackThatReturnsPromiseVoid(...) awaits the returned Promise":
      async (testObject) => {
        const callback = recordCallback(() => Promise.resolve());
        await expect(
          await withTimeout(
            testObject.callCallbackThatReturnsPromiseVoid(callback),
          ),
        ).to.equal(undefined);
        expect(callback.calls).to.have.length(1);
      },

    "getValueFromJSCallbackAndWait(...) awaits a single callback": async (
      testObject,
    ) => {
      await expect(
        Object.is(
          await withTimeout(testObject.getValueFromJSCallbackAndWait(() => 73)),
          73,
        ),
      ).to.equal(true);
    },

    "callAll(...) calls all three callbacks in order": async (testObject) => {
      const calls: string[] = [];
      const first = recordCallback(() => {
        calls.push("first");
      });
      const second = recordCallback(() => {
        calls.push("second");
      });
      const third = recordCallback(() => {
        calls.push("third");
      });
      testObject.callAll(first, second, third);
      await waitFor(() => {
        expect(first.calls).to.have.length(1);
        expect(second.calls).to.have.length(1);
        expect(third.calls).to.have.length(1);
      }, CALLBACK_TIMEOUT);
      expect(calls).to.deep.equal(["first", "second", "third"]);
    },

    "callSumUpNTimes(...) calls the callback multiple times": async (
      testObject,
    ) => {
      const callback = recordCallback(() => 7);
      await expect(
        Object.is(
          await withTimeout(testObject.callSumUpNTimes(callback, 5)),
          7 * 5,
        ),
      ).to.equal(true);
      expect(callback.calls).to.have.length(5);
    },

    "callbackAsyncPromise(...) awaits an async callback on native": async (
      testObject,
    ) => {
      await expect(
        Object.is(
          await withTimeout(testObject.callbackAsyncPromise(async () => 13)),
          13,
        ),
      ).to.equal(true);
    },

    "callbackAsyncPromiseBuffer(...) awaits an async ArrayBuffer callback on native":
      async (testObject) => {
        const result = await withTimeout(
          testObject.callbackAsyncPromiseBuffer(async () => {
            const buffer = await testObject.createArrayBufferAsync();
            // The 10 MB are uninitialized, so mark a few bytes to compare.
            const bytes = new Uint8Array(buffer);
            bytes.set([13, 37]);
            bytes[bytes.length - 1] = 42;
            return buffer;
          }),
        );
        expect(result).to.be.instanceOf(ArrayBuffer);
        expect(
          Object.is(result.byteLength, CREATED_ARRAY_BUFFER_SIZE),
        ).to.equal(true);
        const bytes = new Uint8Array(result);
        expect([bytes[0], bytes[1], bytes[bytes.length - 1]]).to.deep.equal([
          13, 37, 42,
        ]);
      },

    "callbackAsyncPromise(...) rejects when the JS callback throws": async (
      testObject,
    ) => {
      await expect(
        await rejection(
          withTimeout(
            testObject.callbackAsyncPromise(() => {
              throw new Error("throwing in JS!");
            }),
          ),
        ),
      )
        .to.be.instanceOf(Error)
        .and.have.property("message")
        .that.include("throwing in JS!");
    },

    "getComplexCallback() returns a native function": (testObject) => {
      const callback = testObject.getComplexCallback();
      expect(callback).to.be.a("function");
      expect(callback(55)).to.equal(undefined);
    },

    "twoOptionalCallbacks(...) calls both callbacks": async (testObject) => {
      const first = recordCallback();
      const second = recordCallback();
      testObject.twoOptionalCallbacks(55, first, second);
      await waitFor(() => {
        expect(first.calls).to.deep.include([55]);
        // Swift passes 'Hello', C++ and Kotlin pass 'Hello!'
        expect(
          second.calls.some(
            (args) =>
              args.length === 1 &&
              typeof args[0] === "string" &&
              args[0].includes("Hello"),
          ),
        ).to.equal(true);
      }, CALLBACK_TIMEOUT);
    },

    "twoOptionalCallbacks(...) works without callbacks": (testObject) => {
      testObject.twoOptionalCallbacks(55);
    },

    "errorCallback(...) calls back with an Error": async (testObject) => {
      const onError = recordCallback();
      testObject.errorCallback(onError);
      await waitFor(
        () =>
          expect(
            onError.calls.some(
              (args) => args.length === 1 && args[0] instanceof Error,
            ),
          ).to.equal(true),
        CALLBACK_TIMEOUT,
      );
      // Kotlin's message is the JniException's text: the Throwable class name
      // prefix, possibly followed by a stack trace.
      expect(onError.calls[0]?.[0])
        .to.have.property("message")
        .that.matches(/^(?:[\w.$]+: )?Some Error!(?:\n|$)/);
    },

    "createNativeCallback(...) invokes the wrapped JS callback": async (
      testObject,
    ) => {
      const wrapped = recordCallback();
      const callback = testObject.createNativeCallback(wrapped);
      callback(55);
      await waitFor(
        () => expect(wrapped.calls).to.deep.include([55]),
        CALLBACK_TIMEOUT,
      );
    },

    "callCallback(...) calls the callback only after returning": async (
      testObject,
    ) => {
      const callback = recordCallback();
      testObject.callCallback(callback);
      expect(callback.calls).to.have.length(0);
      await waitFor(
        () => expect(callback.calls).to.have.length(1),
        CALLBACK_TIMEOUT,
      );
    },

    "callWithOptional(0, ...) calls back with 0 instead of undefined": async (
      testObject,
    ) => {
      const callback = recordCallback();
      testObject.callWithOptional(0, callback);
      await waitFor(
        () => expect(callback.calls).to.deep.include([0]),
        CALLBACK_TIMEOUT,
      );
    },

    "twoOptionalCallbacks(...) calls only the first callback without a second one":
      async (testObject) => {
        const first = recordCallback();
        testObject.twoOptionalCallbacks(55, first);
        await waitFor(
          () => expect(first.calls).to.deep.include([55]),
          CALLBACK_TIMEOUT,
        );
      },

    "twoOptionalCallbacks(...) calls the second callback when the first is undefined":
      async (testObject) => {
        const second = recordCallback();
        testObject.twoOptionalCallbacks(55, undefined, second);
        await waitFor(
          // Swift passes 'Hello', C++ and Kotlin pass 'Hello!'
          () =>
            expect(
              second.calls.some(
                (args) =>
                  args.length === 1 &&
                  typeof args[0] === "string" &&
                  /^Hello/.test(args[0]),
              ),
            ).to.equal(true),
          CALLBACK_TIMEOUT,
        );
      },

    "createNativeCallback(...) forwards every call in order": async (
      testObject,
    ) => {
      const wrapped = recordCallback();
      const callback = testObject.createNativeCallback(wrapped);
      callback(1);
      callback(2);
      callback(3);
      await waitFor(
        () => expect(wrapped.calls).to.have.length(3),
        CALLBACK_TIMEOUT,
      );
      expect(wrapped.calls).to.deep.equal([[1], [2], [3]]);
    },

    "getComplexCallback() returns a function with length 1": (testObject) => {
      expect(testObject.getComplexCallback()).to.have.length(1);
    },

    "getComplexCallback() function throws when called without arguments": (
      testObject,
    ) => {
      const callback = testObject.getComplexCallback();
      expect(() =>
        // @ts-expect-error intentionally omitting the argument
        callback(),
      ).to.throw(exactly("Function expected 1 arguments, but received 0!"));
    },

    "getComplexCallback() function throws when called with too many arguments":
      (testObject) => {
        const callback = testObject.getComplexCallback();
        expect(() =>
          // @ts-expect-error intentionally passing an extra argument
          callback(1, 2),
        ).to.throw(exactly("Function expected 1 arguments, but received 2!"));
      },

    // TODO: Fix HybridTestObjectSwift.callSumUpNTimes - its `1...Int(n)` range traps for n < 1, so callSumUpNTimes(callback, 0) crashes the app (SIGTRAP); C++ and Kotlin resolve to 0

    "callSumUpNTimes(..., 0) resolves to 0 without calling back": async (
      testObject,
    ) => {
      const callback = recordCallback(() => 7);
      await expect(
        Object.is(
          await withTimeout(testObject.callSumUpNTimes(callback, 0)),
          0,
        ),
      ).to.equal(true);
      expect(callback.calls).to.have.length(0);
    },

    "callSumUpNTimes(..., 20) sums 20 sequential callback results": async (
      testObject,
    ) => {
      let count = 0;
      const callback = recordCallback(() => ++count);
      await expect(
        Object.is(
          await withTimeout(testObject.callSumUpNTimes(callback, 20), 5000),
          (20 * 21) / 2,
        ),
      ).to.equal(true);
      expect(callback.calls).to.have.length(20);
    },

    "callSumUpNTimes(...) rejects when the callback throws": async (
      testObject,
    ) => {
      const callback = () => {
        throw new Error("sum callback failed");
      };
      await expect(
        await rejection(withTimeout(testObject.callSumUpNTimes(callback, 3))),
      )
        .to.be.instanceOf(Error)
        .and.have.property("message")
        .that.include("sum callback failed");
    },

    "callSumUpNTimes(...) stops calling back after the callback threw": async (
      testObject,
    ) => {
      let count = 0;
      const callback = recordCallback(() => {
        count++;
        if (count === 2) {
          throw new Error("second call failed");
        }
        return 1;
      });
      await expect(
        await rejection(withTimeout(testObject.callSumUpNTimes(callback, 5))),
      )
        .to.be.instanceOf(Error)
        .and.have.property("message")
        .that.include("second call failed");
      expect(callback.calls).to.have.length(2);
    },

    "getValueFromJSCallbackAndWait(...) rejects when getValue throws": async (
      testObject,
    ) => {
      const getValue = () => {
        throw new Error("getValue failed");
      };
      await expect(
        await rejection(
          withTimeout(testObject.getValueFromJSCallbackAndWait(getValue)),
        ),
      )
        .to.be.instanceOf(Error)
        .and.have.property("message")
        .that.include("getValue failed");
    },

    "getValueFromJsCallback(...) rejects when the callback throws": async (
      testObject,
    ) => {
      const callback = () => {
        throw new Error("getting the value failed");
      };
      await expect(
        await rejection(
          withTimeout(testObject.getValueFromJsCallback(callback, () => {})),
        ),
      )
        .to.be.instanceOf(Error)
        .and.have.property("message")
        .that.include("getting the value failed");
    },

    "getValueFromJsCallback(...) skips andThenCall when the callback throws":
      async (testObject) => {
        const andThenCall = recordCallback();
        const callback = () => {
          throw new Error("getting the value failed");
        };
        await expect(
          await rejection(
            withTimeout(
              testObject.getValueFromJsCallback(callback, andThenCall),
            ),
          ),
        ).to.be.instanceOf(Error);
        expect(andThenCall.calls).to.have.length(0);
      },

    "getValueFromJsCallback(...) passes a non-ASCII string unchanged": async (
      testObject,
    ) => {
      const value = "Grüße, 世界 👋";
      const andThenCall = recordCallback();
      await withTimeout(
        testObject.getValueFromJsCallback(() => value, andThenCall),
      );
      await waitFor(
        () => expect(andThenCall.calls).to.deep.include([value]),
        CALLBACK_TIMEOUT,
      );
    },

    "callbackAsyncPromise(...) awaits a callback that resolves later": async (
      testObject,
    ) => {
      const callback = () => delay(50, 21);
      await expect(
        Object.is(
          await withTimeout(testObject.callbackAsyncPromise(callback)),
          21,
        ),
      ).to.equal(true);
    },

    'callbackAsyncPromise(...) rejects with "<name>: <message>" when the async callback rejects':
      async (testObject) => {
        const callback = () =>
          Promise.reject<number>(new Error("rejected in an async callback"));
        await expect(
          await rejection(
            withTimeout(testObject.callbackAsyncPromise(callback)),
          ),
        )
          .to.be.instanceOf(Error)
          .and.have.property("message")
          .that.include("Error: rejected in an async callback");
      },

    // TODO: Fix HybridTestObjectCpp.callCallbackThatReturnsPromiseVoid - it calls `future.wait()` but never `future.get()`, so it resolves to undefined when the callback's Promise rejects; Swift and Kotlin reject

    "callCallbackThatReturnsPromiseVoid(...) rejects when the returned Promise rejects":
      async (testObject) => {
        const callback = () =>
          Promise.reject<void>(new Error("void Promise rejected"));
        await expect(
          await rejection(
            withTimeout(
              testObject.callCallbackThatReturnsPromiseVoid(callback),
            ),
          ),
        )
          .to.be.instanceOf(Error)
          .and.have.property("message")
          .that.include("Error: void Promise rejected");
      },

    "callbackAsyncPromiseBuffer(...) keeps the bytes of a JS ArrayBuffer":
      async (testObject) => {
        const buffer = new Uint8Array([0, 1, 127, 128, 255]).buffer;
        const result = await withTimeout(
          testObject.callbackAsyncPromiseBuffer(() => Promise.resolve(buffer)),
        );
        expect(result).to.be.instanceOf(ArrayBuffer);
        expect(new Uint8Array(result)).to.deep.equal(
          new Uint8Array([0, 1, 127, 128, 255]),
        );
      },
  }),
  ...casesForTestObjects("Sync callbacks", {
    "callbackSync(...) calls the callback synchronously": (testObject) => {
      const callback = recordCallback(() => 55);
      expect(Object.is(testObject.callbackSync(callback), 55)).to.equal(true);
      expect(callback.calls).to.have.length(1);
    },

    "getSyncNumberCallback() returns a callback that returns 55": (
      testObject,
    ) => {
      const callback = testObject.getSyncNumberCallback();
      expect(Object.is(callback(), 55)).to.equal(true);
    },

    "bounceSyncInt64Callback(...) roundtrips -9223372036854775808": (
      testObject,
    ) => {
      const value = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n][0]!;

      const callback = testObject.bounceSyncInt64Callback((input) => input);
      expect(Object.is(callback(value), value)).to.equal(true);
    },

    "bounceSyncInt64Callback(...) roundtrips -1": (testObject) => {
      const value = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n][1]!;

      const callback = testObject.bounceSyncInt64Callback((input) => input);
      expect(Object.is(callback(value), value)).to.equal(true);
    },

    "bounceSyncInt64Callback(...) roundtrips 0": (testObject) => {
      const value = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n][2]!;

      const callback = testObject.bounceSyncInt64Callback((input) => input);
      expect(Object.is(callback(value), value)).to.equal(true);
    },

    "bounceSyncInt64Callback(...) roundtrips 9223372036854775807": (
      testObject,
    ) => {
      const value = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n][3]!;

      const callback = testObject.bounceSyncInt64Callback((input) => input);
      expect(Object.is(callback(value), value)).to.equal(true);
    },

    "callbackSync(...) calls the callback without arguments": (testObject) => {
      const callback = recordCallback(() => 55);
      testObject.callbackSync(callback);
      expect(callback.calls).to.deep.include([]);
    },

    "callbackSync(...) returns a fractional result unchanged": (testObject) => {
      expect(
        Object.is(
          testObject.callbackSync(() => -13.37),
          -13.37,
        ),
      ).to.equal(true);
    },

    // TODO: Fix in Nitro - callbackSync(...) with a throwing JS callback crashes the app on Swift (SIGABRT: the JS error escapes the `noexcept` bridge::swift::Func_double_Wrapper::call() -> std::terminate); C++ rethrows it

    "callbackSync(...) rethrows the JS error with the method name": (
      testObject,
    ) => {
      const callback = () => {
        throw new Error("sync callback failed");
      };
      expect(() => testObject.callbackSync(callback)).to.throw(
        new RegExp(
          `^${escapeRegExp(`${testObject.name}.callbackSync(...): `)}.*sync callback failed`,
        ),
      );
    },

    "getSyncNumberCallback() function throws when called with an argument": (
      testObject,
    ) => {
      const callback = testObject.getSyncNumberCallback();
      expect(() =>
        // @ts-expect-error intentionally passing an extra argument
        callback(1),
      ).to.throw(exactly("Function expected 0 arguments, but received 1!"));
    },

    "bounceSyncInt64Callback(...) returns the result of the JS callback": (
      testObject,
    ) => {
      const callback = testObject.bounceSyncInt64Callback(
        (input) => input * 2n,
      );
      expect(Object.is(callback(21n), 42n)).to.equal(true);
    },

    "bounceSyncInt64Callback(...) calls the JS callback synchronously": (
      testObject,
    ) => {
      const jsCallback = recordCallback((input: bigint) => input);
      const callback = testObject.bounceSyncInt64Callback(jsCallback);
      callback(5n);
      expect(jsCallback.calls).to.deep.include([5n]);
    },
  }),
};

export const skips = {
  "Callbacks / TestObjectSwiftKotlin / callSumUpNTimes(..., 0) resolves to 0 without calling back":
    {
      ios: "Fix HybridTestObjectSwift.callSumUpNTimes - its `1...Int(n)` range traps for n < 1, so callSumUpNTimes(callback, 0) crashes the app (SIGTRAP); C++ and Kotlin resolve to 0",
    },
  "Callbacks / TestObjectCpp / callCallbackThatReturnsPromiseVoid(...) rejects when the returned Promise rejects":
    {
      ios: "Fix HybridTestObjectCpp.callCallbackThatReturnsPromiseVoid - it calls `future.wait()` but never `future.get()`, so it resolves to undefined when the callback's Promise rejects; Swift and Kotlin reject",
      android:
        "Fix HybridTestObjectCpp.callCallbackThatReturnsPromiseVoid - it calls `future.wait()` but never `future.get()`, so it resolves to undefined when the callback's Promise rejects; Swift and Kotlin reject",
    },
  "Sync callbacks / TestObjectSwiftKotlin / callbackSync(...) rethrows the JS error with the method name":
    {
      ios: "Fix in Nitro - callbackSync(...) with a throwing JS callback crashes the app on Swift (SIGABRT: the JS error escapes the `noexcept` bridge::swift::Func_double_Wrapper::call() -> std::terminate); C++ rethrows it",
    },
} as const;
