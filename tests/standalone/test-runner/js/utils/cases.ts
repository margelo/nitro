import { NitroModules } from "nitro-core";
import { TestObjectCpp, TestObjectSwiftKotlin } from "nitro-test";

type Timeout = { timeoutMs?: number };
export type TestCase = (() => void | Promise<void>) & Timeout;
type TestObject = TestObjectCpp | TestObjectSwiftKotlin;
type TestObjectCase = ((object: TestObject) => void | Promise<void>) & Timeout;

/** Give an expensive case an explicit native execution budget. */
export function withTestTimeout<
  Test extends (...args: never[]) => void | Promise<void>,
>(timeoutMs: number, test: Test): Test & { timeoutMs: number } {
  return Object.assign(test, { timeoutMs });
}
type Implementation = "TestObjectCpp" | "TestObjectSwiftKotlin";

/** Bind each case lazily so one fresh native object belongs to one native test. */
export function casesForTestObjects<
  Suite extends string,
  Cases extends Record<string, TestObjectCase>,
>(
  suite: Suite,
  cases: Cases,
): Record<`${Suite} / ${Implementation} / ${keyof Cases & string}`, TestCase> {
  const result: Record<string, TestCase> = {};
  for (const implementation of [
    "TestObjectCpp",
    "TestObjectSwiftKotlin",
  ] as const) {
    for (const [name, test] of Object.entries(cases)) {
      result[`${suite} / ${implementation} / ${name}`] = Object.assign(
        () =>
          test(
            implementation === "TestObjectCpp"
              ? new TestObjectCpp()
              : new TestObjectSwiftKotlin(),
          ),
        { timeoutMs: test.timeoutMs },
      );
    }
  }
  return result;
}

export function namedCases<
  Suite extends string,
  Cases extends Record<string, TestCase>,
>(
  suite: Suite,
  cases: Cases,
): Record<`${Suite} / ${keyof Cases & string}`, TestCase> {
  return Object.fromEntries(
    Object.entries(cases).map(([name, test]) => [`${suite} / ${name}`, test]),
  ) as Record<`${Suite} / ${keyof Cases & string}`, TestCase>;
}

// A recorder only stores calls and invokes the supplied callback. Assertions use
// Chai directly; there is no mocking or alternate assertion framework here.
type Callback = (...args: any[]) => any;
export function recordCallback<
  F extends Callback = (...args: unknown[]) => void,
>(implementation?: F): F & { calls: Parameters<F>[] } {
  const calls: Parameters<F>[] = [];
  const recorded = (...args: Parameters<F>): ReturnType<F> => {
    calls.push(args);
    return implementation?.(...args);
  };
  return Object.assign(recorded, { calls }) as F & { calls: Parameters<F>[] };
}

/** Yield through the native dispatcher; this Hermes host has no JS timer APIs. */
export async function delay<T = void>(ms: number, value?: T): Promise<T> {
  const timer = new TestObjectCpp();
  await timer.wait(ms / 1000);
  return value as T;
}

export function yieldToEventLoop(): Promise<void> {
  return delay(0);
}

export async function waitFor(
  check: () => void,
  options: { timeout: number } = { timeout: 1000 },
): Promise<void> {
  const deadline = Date.now() + options.timeout;
  while (true) {
    try {
      check();
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    await delay(10);
  }
}

export function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  let settled = false;
  const watched = promise.finally(() => {
    settled = true;
  });
  const deadline = Date.now() + ms;
  async function timeout(): Promise<T> {
    // Short waits allow a successful test to stop polling without leaving a
    // sleeping native worker behind for the entire timeout interval.
    while (!settled) {
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new Error(`Promise did not settle within ${ms}ms`);
      await delay(Math.min(10, remaining));
    }
    return watched;
  }
  return Promise.race([watched, timeout()]);
}

export const STILL_PENDING = "still pending";
export function settledWithin<T>(
  promise: Promise<T>,
  ms = 100,
): Promise<T | typeof STILL_PENDING> {
  return Promise.race([
    promise,
    delay<typeof STILL_PENDING>(ms, STILL_PENDING),
  ]);
}

export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the Promise to reject, but it resolved");
}
