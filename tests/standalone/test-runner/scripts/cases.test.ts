import { afterEach, expect, mock, test } from 'bun:test'
import { registerTests } from '../js/index'
const created: string[] = []
mock.module('nitro-core', () => ({ NitroModules: {} }))
mock.module('nitro-test', () => ({
  TestObjectCpp: class TestObjectCpp {
    constructor() {
      created.push('TestObjectCpp')
    }
  },
  TestObjectSwiftKotlin: class TestObjectSwiftKotlin {
    constructor() {
      created.push('TestObjectSwiftKotlin')
    }
  },
  Child: class Child {},
}))
mock.module('nitro-test-external', () => ({
  SomeExternalObject: class SomeExternalObject {},
  SharedSpecializationsCpp: class SharedSpecializationsCpp {
    constructor() {
      created.push('SharedSpecializationsCpp')
    }
  },
  SharedSpecializations: class SharedSpecializations {
    constructor() {
      created.push('SharedSpecializations')
    }
  },
}))
const { casesForSharedSpecializations, casesForTestObjects, namedCases, withTestTimeout } = await import('../js/utils/cases')

const originalRun = globalThis.runNitroTest
const originalTimeout = globalThis.getNitroTestTimeoutMs
afterEach(() => {
  created.length = 0
  globalThis.runNitroTest = originalRun
  globalThis.getNitroTestTimeoutMs = originalTimeout
})

test('unannotated cases leave the native default unchanged', async () => {
  let called = false
  registerTests({
    ordinary: () => {
      called = true
    },
  })
  expect(globalThis.getNitroTestTimeoutMs('ordinary')).toBeUndefined()
  await globalThis.runNitroTest('ordinary')
  expect(called).toBe(true)
})

test('fixture binding preserves timeouts without allocating the fixture', async () => {
  const received: string[] = []
  const cases = casesForTestObjects('Memory', {
    allocate: withTestTimeout(150_000, (object) => {
      received.push(object.constructor.name)
    }),
    ordinary: () => {},
  })
  registerTests(cases)

  for (const implementation of ['TestObjectCpp', 'TestObjectSwiftKotlin']) {
    const name = `Memory / ${implementation} / allocate`
    expect(globalThis.getNitroTestTimeoutMs(name)).toBe(150_000)
    expect(globalThis.getNitroTestTimeoutMs(`Memory / ${implementation} / ordinary`)).toBeUndefined()
  }
  expect(created).toEqual([])
  await globalThis.runNitroTest('Memory / TestObjectCpp / allocate')
  await globalThis.runNitroTest('Memory / TestObjectSwiftKotlin / allocate')
  expect(created).toEqual(['TestObjectCpp', 'TestObjectSwiftKotlin'])
  expect(received).toEqual(created)
})

test('shared specialization binding pairs every external and local implementation', async () => {
  const received: string[][] = []
  const cases = casesForSharedSpecializations('Shared', {
    pair: withTestTimeout(700, (external, local) => {
      received.push([external.constructor.name, local.constructor.name])
    }),
    ordinary: () => {},
  })
  registerTests(cases)

  const pairs = [
    ['SharedSpecializationsCpp', 'TestObjectCpp'],
    ['SharedSpecializationsCpp', 'TestObjectSwiftKotlin'],
    ['SharedSpecializations', 'TestObjectCpp'],
    ['SharedSpecializations', 'TestObjectSwiftKotlin'],
  ]
  expect(Object.keys(cases).sort()).toEqual(
    pairs.flatMap(([external, local]) => [`Shared / ${external} + ${local} / ordinary`, `Shared / ${external} + ${local} / pair`]).sort()
  )
  for (const [external, local] of pairs) {
    expect(globalThis.getNitroTestTimeoutMs(`Shared / ${external} + ${local} / pair`)).toBe(700)
    expect(globalThis.getNitroTestTimeoutMs(`Shared / ${external} + ${local} / ordinary`)).toBeUndefined()
  }
  expect(created).toEqual([])
  for (const [external, local] of pairs) {
    await globalThis.runNitroTest(`Shared / ${external} + ${local} / pair`)
  }
  expect(received).toEqual(pairs)
  expect(created).toEqual(pairs.flat())
})

test('named cases retain an explicit timeout', () => {
  registerTests(namedCases('Stress', { allocate: withTestTimeout(500, () => {}) }))
  expect(globalThis.getNitroTestTimeoutMs('Stress / allocate')).toBe(500)
})

test('timeout lookup rejects unknown and inherited case names', () => {
  registerTests({ ordinary: () => {} })
  for (const name of ['missing', 'constructor']) {
    expect(() => globalThis.getNitroTestTimeoutMs(name)).toThrow(`Unknown Nitro test: ${name}`)
  }
})

test('only the four allocation stress cases receive a longer budget', async () => {
  const { cases } = await import('../js/memory.test')
  registerTests(cases)
  const overrides = Object.keys(cases).filter((name) => globalThis.getNitroTestTimeoutMs(name) !== undefined)
  expect(overrides.sort()).toEqual([
    'Memory / TestObjectCpp / newTestObject() objects are reclaimed by JS GC',
    'Memory / TestObjectCpp / newTestObject() objects are released by manual dispose()',
    'Memory / TestObjectSwiftKotlin / newTestObject() objects are reclaimed by JS GC',
    'Memory / TestObjectSwiftKotlin / newTestObject() objects are released by manual dispose()',
  ])
  for (const name of overrides) {
    expect(globalThis.getNitroTestTimeoutMs(name)).toBe(150_000)
  }
})
