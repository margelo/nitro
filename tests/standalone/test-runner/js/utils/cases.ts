import { NitroModules } from 'nitro-core'
import { TestObjectCpp, TestObjectSwiftKotlin } from 'nitro-test'
import { SharedSpecializations, SharedSpecializationsCpp } from 'nitro-test-external'
import { casesForImplementationPairs, casesForImplementations, type TestCase } from './suites'

export { namedCases, withTestTimeout, type TestCase } from './suites'

type Timeout = { timeoutMs?: number }
type TestObject = TestObjectCpp | TestObjectSwiftKotlin
type TestObjectCase = ((object: TestObject) => void | Promise<void>) & Timeout
type Implementation = 'TestObjectCpp' | 'TestObjectSwiftKotlin'
type SharedSpecializationsObject = SharedSpecializationsCpp | SharedSpecializations
type SharedSpecializationsCase = ((external: SharedSpecializationsObject, local: TestObject) => void | Promise<void>) & Timeout
type ExternalImplementation = 'SharedSpecializationsCpp' | 'SharedSpecializations'

const testObjects: Record<Implementation, () => TestObject> = {
  TestObjectCpp: () => new TestObjectCpp(),
  TestObjectSwiftKotlin: () => new TestObjectSwiftKotlin(),
}
const sharedSpecializations: Record<ExternalImplementation, () => SharedSpecializationsObject> = {
  SharedSpecializationsCpp: () => new SharedSpecializationsCpp(),
  SharedSpecializations: () => new SharedSpecializations(),
}

/** Bind each case lazily so one fresh native object belongs to one native test. */
export function casesForTestObjects<Suite extends string, Cases extends Record<string, TestObjectCase>>(
  suite: Suite,
  cases: Cases
): Record<`${Suite} / ${Implementation} / ${keyof Cases & string}`, TestCase> {
  return casesForImplementations(suite, testObjects, cases)
}

/**
 * Pair each external implementation with each local one, so the C++, Swift and
 * Kotlin objects of both modules share one native test process in every combination.
 */
export function casesForSharedSpecializations<Suite extends string, Cases extends Record<string, SharedSpecializationsCase>>(
  suite: Suite,
  cases: Cases
): Record<`${Suite} / ${ExternalImplementation} + ${Implementation} / ${keyof Cases & string}`, TestCase> {
  return casesForImplementationPairs(suite, sharedSpecializations, testObjects, cases)
}

// A recorder only stores calls and invokes the supplied callback. Assertions use
// Chai directly; there is no mocking or alternate assertion framework here.
type Callback = (...args: any[]) => any
export function recordCallback<F extends Callback = (...args: unknown[]) => void>(implementation?: F): F & { calls: Parameters<F>[] } {
  const calls: Parameters<F>[] = []
  const recorded = (...args: Parameters<F>): ReturnType<F> => {
    calls.push(args)
    return implementation?.(...args)
  }
  return Object.assign(recorded, { calls }) as F & { calls: Parameters<F>[] }
}

/** Yield through the native dispatcher; this Hermes host has no JS timer APIs. */
export async function delay<T = void>(ms: number, value?: T): Promise<T> {
  const timer = new TestObjectCpp()
  await timer.wait(ms / 1000)
  return value as T
}

export function yieldToEventLoop(): Promise<void> {
  return delay(0)
}

export async function waitFor(check: () => void, options: { timeout: number } = { timeout: 1000 }): Promise<void> {
  const deadline = Date.now() + options.timeout
  while (true) {
    try {
      check()
      return
    } catch (error) {
      if (Date.now() >= deadline) throw error
    }
    await delay(10)
  }
}

export function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  let settled = false
  const watched = promise.finally(() => {
    settled = true
  })
  const deadline = Date.now() + ms
  async function timeout(): Promise<T> {
    // Short waits allow a successful test to stop polling without leaving a
    // sleeping native worker behind for the entire timeout interval.
    while (!settled) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error(`Promise did not settle within ${ms}ms`)
      await delay(Math.min(10, remaining))
    }
    return watched
  }
  return Promise.race([watched, timeout()])
}

export const STILL_PENDING = 'still pending'
export function settledWithin<T>(promise: Promise<T>, ms = 100): Promise<T | typeof STILL_PENDING> {
  return Promise.race([promise, delay<typeof STILL_PENDING>(ms, STILL_PENDING)])
}

export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the Promise to reject, but it resolved')
}
