// Naming, binding and budgets for test cases. This module imports no native
// module, so Bun can unit-test it directly.

type Timeout = { timeoutMs?: number }
export type TestCase = (() => void | Promise<void>) & Timeout

/** Give an expensive case an explicit native execution budget. */
export function withTestTimeout<Test extends (...args: never[]) => void | Promise<void>>(
  timeoutMs: number,
  test: Test
): Test & { timeoutMs: number } {
  return Object.assign(test, { timeoutMs })
}

export function namedCases<Suite extends string, Cases extends Record<string, TestCase>>(
  suite: Suite,
  cases: Cases
): Record<`${Suite} / ${keyof Cases & string}`, TestCase> {
  return Object.fromEntries(Object.entries(cases).map(([name, test]) => [`${suite} / ${name}`, test])) as Record<
    `${Suite} / ${keyof Cases & string}`,
    TestCase
  >
}

/**
 * Run each case once per implementation. A case creates its object only when
 * it runs, so one fresh object belongs to one native test.
 */
export function casesForImplementations<
  Suite extends string,
  Implementations extends Record<string, () => unknown>,
  Cases extends Record<string, ((object: ReturnType<Implementations[keyof Implementations]>) => void | Promise<void>) & Timeout>,
>(
  suite: Suite,
  implementations: Implementations,
  cases: Cases
): Record<`${Suite} / ${keyof Implementations & string} / ${keyof Cases & string}`, TestCase> {
  const result: Record<string, TestCase> = {}
  for (const [implementation, create] of Object.entries(implementations)) {
    for (const [name, test] of Object.entries(cases)) {
      result[`${suite} / ${implementation} / ${name}`] = Object.assign(
        () => test(create() as ReturnType<Implementations[keyof Implementations]>),
        { timeoutMs: test.timeoutMs }
      )
    }
  }
  return result
}

/**
 * Run each case once per pair of implementations, such as an external and a
 * local HybridObject. Both objects are created only when the case runs.
 */
export function casesForImplementationPairs<
  Suite extends string,
  Firsts extends Record<string, () => unknown>,
  Seconds extends Record<string, () => unknown>,
  Cases extends Record<
    string,
    ((first: ReturnType<Firsts[keyof Firsts]>, second: ReturnType<Seconds[keyof Seconds]>) => void | Promise<void>) & Timeout
  >,
>(
  suite: Suite,
  firsts: Firsts,
  seconds: Seconds,
  cases: Cases
): Record<`${Suite} / ${keyof Firsts & string} + ${keyof Seconds & string} / ${keyof Cases & string}`, TestCase> {
  const result: Record<string, TestCase> = {}
  for (const [first, createFirst] of Object.entries(firsts)) {
    for (const [second, createSecond] of Object.entries(seconds)) {
      for (const [name, test] of Object.entries(cases)) {
        result[`${suite} / ${first} + ${second} / ${name}`] = Object.assign(
          () => test(createFirst() as ReturnType<Firsts[keyof Firsts]>, createSecond() as ReturnType<Seconds[keyof Seconds]>),
          { timeoutMs: test.timeoutMs }
        )
      }
    }
  }
  return result
}
