import { expect } from 'chai'
import { casesForTestObjects, namedCases, recordCallback, waitFor, withTestTimeout, yieldToEventLoop } from './utils/cases'

import { NitroModules } from 'nitro-core'

import { type TestObject } from './utils/testObjects'

// 55k allocations verify that there are no memory leaks for two reasons;
// 1) It's a lot of allocations and any VM (JS, JVM) will likely trigger GC
// 2) In JVM, 51_200 is the limit for `jni::global_ref`s, then the app crashes - this intentionally exhausts that
const MEMORY_LEAK_TEST_ALLOCATION_COUNT = 55_000

const EXTERNAL_MEMORY_TEST_SIZE = 1024 * 1024

// If less than 10% of the allocations are still alive, GC freed most of them
const MAX_REMAINING_ALLOCATIONS = MEMORY_LEAK_TEST_ALLOCATION_COUNT * 0.1

const GC_BATCH_SIZE = 1000

type HermesInternal = {
  getInstrumentedStats?: () => { js_externalBytes: number }
}

function getHermesInternal(): HermesInternal | undefined {
  return (globalThis as typeof globalThis & { HermesInternal?: HermesInternal }).HermesInternal
}

function getHermesExternalMemorySize(): number {
  const hermesInternal = getHermesInternal()

  if (hermesInternal?.getInstrumentedStats == null) {
    throw new Error('Hermes instrumentation is unavailable!')
  }

  return hermesInternal.getInstrumentedStats().js_externalBytes
}

/**
 * Creates a pending JS Promise that keeps the native `then(onResolved, onRejected)` listeners Nitro
 * adds to it, instead of handing them to the JS engine, so a test can destroy their native state.
 */
function createListenedPromise(): { promise: Promise<number>; listeners: ((value: unknown) => void)[] } {
  const listeners: ((value: unknown) => void)[] = []
  const promise = new Promise<number>(() => {})
  Object.defineProperty(promise, 'then', {
    value: (onResolved: (value: unknown) => void, onRejected: (value: unknown) => void) => {
      listeners.push(onResolved, onRejected)
    },
  })
  return { promise, listeners }
}

export const cases = {
  ...casesForTestObjects('Memory', {
    'awaitAndGetPromise(...) listeners can be destroyed on another thread while pending': async (testObject) => {
      const { promise, listeners } = createListenedPromise()
      // Destroying the listeners rejects the native Promise if nothing else holds it.
      testObject.awaitAndGetPromise(promise).catch(() => {})
      expect(listeners).to.have.length(2)

      for (const listener of listeners) destroyOnBackgroundThread(listener)
      await yieldToEventLoop()
    },

    'awaitAndGetPromise(...) listeners can be destroyed on another thread after resolving': async (testObject) => {
      const { promise, listeners } = createListenedPromise()
      const result = testObject.awaitAndGetPromise(promise)
      expect(listeners).to.have.length(2)

      listeners[0]?.(42)
      expect(await result).to.equal(42)
      for (const listener of listeners) destroyOnBackgroundThread(listener)
    },

    'createNativeCallback(...) callbacks still work after gc()': async (testObject) => {
      const onCalled = recordCallback<(num: number) => void>()
      const callbacks: ((num: number) => void)[] = []
      for (let i = 0; i < 10_000; i++) {
        const cb = testObject.createNativeCallback((num) => {
          onCalled(i + num)
        })
        callbacks.push(cb)
      }
      gc()

      callbacks[callbacks.length - 1]?.(1)
      await waitFor(() => expect(onCalled.calls).to.deep.include([10_000]), {
        timeout: 2000,
      })

      // Free the callbacks that are bound to native functions while this JS
      // runtime is still alive.
      callbacks.length = 0
      gc()
    },

    'newTestObject() objects are reclaimed by JS GC': withTestTimeout(150_000, async (testObject: TestObject) => {
      const baselineAllocations = NitroModules.debug_getTotalAllocatedHybridObjects()

      const objects: TestObject[] = []
      for (let i = 0; i < MEMORY_LEAK_TEST_ALLOCATION_COUNT; i++) {
        const object = testObject.newTestObject()
        object.numberValue = i
        objects.push(object)

        if (objects.length >= GC_BATCH_SIZE) {
          objects.length = 0
          gc()
          await yieldToEventLoop()
        }
      }

      objects.length = 0
      gc()
      gc()
      gc()

      const currentAllocations = NitroModules.debug_getTotalAllocatedHybridObjects()
      expect(
        currentAllocations - baselineAllocations,
        `HybridObjects still alive (baseline: ${baselineAllocations}, current: ${currentAllocations})`
      ).to.be.lessThan(MAX_REMAINING_ALLOCATIONS)
    }),

    'newTestObject() objects are released by manual dispose()': withTestTimeout(150_000, async (testObject: TestObject) => {
      const baselineAllocations = NitroModules.debug_getTotalAllocatedHybridObjects()

      for (let i = 0; i < MEMORY_LEAK_TEST_ALLOCATION_COUNT; i++) {
        const object = testObject.newTestObject()
        object.dispose()

        if ((i + 1) % GC_BATCH_SIZE === 0) {
          gc()
          await yieldToEventLoop()
        }
      }

      gc()

      const currentAllocations = NitroModules.debug_getTotalAllocatedHybridObjects()
      expect(
        currentAllocations - baselineAllocations,
        `HybridObjects still alive (baseline: ${baselineAllocations}, current: ${currentAllocations})`
      ).to.be.lessThan(MAX_REMAINING_ALLOCATIONS)
    }),

    'dispose() calls optionalCallback one last time': async (testObject) => {
      const hybridObject = testObject.newTestObject()
      const optionalCallback = recordCallback<(value: number) => void>()
      hybridObject.optionalCallback = optionalCallback
      // dispose() will call this.optionalCallback() one last time then the object is gone
      hybridObject.dispose()
      await waitFor(() => expect(optionalCallback.calls).to.deep.include([13]), {
        timeout: 2000,
      })
    },

    'NitroModules.updateMemorySize(obj) updates external memory pressure': (testObject) => {
      const originalString = testObject.stringValue

      try {
        testObject.stringValue = ''
        NitroModules.updateMemorySize(testObject)

        testObject.stringValue = 'x'.repeat(EXTERNAL_MEMORY_TEST_SIZE)
        // Reporting external memory can trigger a GC, which would then also free
        // unrelated garbage (like the 1 MiB string above) - so collect it first.
        gc()
        const externalBytesBefore = getHermesExternalMemorySize()
        NitroModules.updateMemorySize(testObject)
        const externalBytesAfter = getHermesExternalMemorySize()

        expect(Object.is(externalBytesAfter - externalBytesBefore, EXTERNAL_MEMORY_TEST_SIZE)).to.equal(true)
      } finally {
        testObject.stringValue = originalString
        NitroModules.updateMemorySize(testObject)
      }
    },
  }),
  ...namedCases('NitroModules memory', {
    'NitroModules.createNativeArrayBuffer(...) reports external memory pressure': () => {
      const size = EXTERNAL_MEMORY_TEST_SIZE
      // Reporting external memory can trigger a GC, which would then also free
      // garbage of earlier tests (like 1 MiB strings) - so collect it first.
      gc()
      const externalBytesBefore = getHermesExternalMemorySize()
      const buffer = NitroModules.createNativeArrayBuffer(size)
      const externalBytesAfter = getHermesExternalMemorySize()

      expect(Object.is(buffer.byteLength, size)).to.equal(true)
      expect(Object.is(externalBytesAfter - externalBytesBefore, size)).to.equal(true)
    },
  }),
  ...namedCases('Memory budgets', {
    'only the four allocation stress cases receive a longer budget': () => {
      const overrides = Object.entries(cases).filter(([, test]) => test.timeoutMs !== undefined)
      expect(overrides.map(([name]) => name).sort()).to.deep.equal([
        'Memory / TestObjectCpp / newTestObject() objects are reclaimed by JS GC',
        'Memory / TestObjectCpp / newTestObject() objects are released by manual dispose()',
        'Memory / TestObjectSwiftKotlin / newTestObject() objects are reclaimed by JS GC',
        'Memory / TestObjectSwiftKotlin / newTestObject() objects are released by manual dispose()',
      ])
      for (const [, test] of overrides) {
        expect(test.timeoutMs).to.equal(150_000)
      }
    },
  }),
}
