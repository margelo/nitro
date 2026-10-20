import { expect } from 'chai'
import type { Person, Powertrain } from 'nitro-test'
import { casesForTestObjects, rejection, withTimeout } from './utils/cases'
import { deferred } from './utils/helpers'

export const cases = {
  ...casesForTestObjects('Native container callbacks', {
    'callEnumArrayCallback(...) passes native enums to JS and returns the JS array':
      (testObject) => {
        const received: Powertrain[][] = []
        const result = testObject.callEnumArrayCallback(
          ['gas', 'hybrid'],
          (array) => {
            received.push(array)
            return ['electric', ...array]
          },
        )
        expect(received).to.deep.equal([['gas', 'hybrid']])
        expect(result).to.deep.equal(['electric', 'gas', 'hybrid'])
      },

    'callEnumArrayCallback(...) accepts an empty returned enum array': (
      testObject,
    ) => {
      const result = testObject.callEnumArrayCallback(['hybrid'], () => [])
      expect(result).to.deep.equal([])
    },

    'callEnumArrayCallback(...) propagates a thrown JS error': (testObject) => {
      expect(() =>
        testObject.callEnumArrayCallback(['gas'], () => {
          throw new Error('Enum array callback failed')
        }),
      ).to.throw('Enum array callback failed')
    },

    'getEnumArrayCallback() returns a native callback callable from JS': (
      testObject,
    ) => {
      const callback = testObject.getEnumArrayCallback()
      expect(callback(['electric', 'gas', 'electric'])).to.deep.equal([
        'electric',
        'gas',
        'electric',
      ])
      expect(callback([])).to.deep.equal([])
    },

    'callNestedStructCallback(...) keeps nested arrays, optional structs and callback results':
      (testObject) => {
        const input: (Person | undefined)[][] = [
          [{ name: 'Marc', age: 24 }, undefined],
          [],
          [undefined, { name: 'Ben', age: 5 }],
        ]
        const replacement: (Person | undefined)[][] = [
          [undefined],
          [{ name: 'Alice', age: 31 }],
        ]
        const received: (Person | undefined)[][][] = []
        const result = testObject.callNestedStructCallback(input, (value) => {
          received.push(value)
          return replacement
        })
        expect(received).to.deep.equal([input])
        expect(result).to.deep.equal(replacement)
      },
  }),

  ...casesForTestObjects('Native container promises', {
    "callEnumArrayPromiseCallback(...) awaits the JS callback's enum array Promise":
      async (testObject) => {
        let calls = 0
        const result = await withTimeout(
          testObject.callEnumArrayPromiseCallback(async () => {
            calls += 1
            await Promise.resolve()
            return ['gas', 'electric']
          }),
        )
        expect(calls).to.equal(1)
        expect(result).to.deep.equal(['gas', 'electric'])
      },

    'callEnumArrayPromiseCallback(...) rejects when the JS Promise rejects':
      async (testObject) => {
        const result = testObject.callEnumArrayPromiseCallback(() =>
          Promise.reject(new Error('Enum array Promise failed')),
        )
        expect(await rejection(withTimeout(result)))
          .to.have.property('message')
          .that.contains('Enum array Promise failed')
      },

    'callEnumArrayPromiseCallback(...) rejects when the JS callback throws':
      async (testObject) => {
        const result = testObject.callEnumArrayPromiseCallback(() => {
          throw new Error('Enum array Promise callback failed')
        })
        expect(await rejection(withTimeout(result)))
          .to.have.property('message')
          .that.contains('Enum array Promise callback failed')
      },

    'awaitEnumArrayPromise(...) resolves a pending JS Promise through a native Promise':
      async (testObject) => {
        const jsPromise = deferred<Powertrain[]>()
        const nativePromise = testObject.awaitEnumArrayPromise(
          jsPromise.promise,
        )
        jsPromise.resolve(['hybrid', 'electric', 'gas'])
        expect(await withTimeout(nativePromise)).to.deep.equal([
          'hybrid',
          'electric',
          'gas',
        ])
      },

    'awaitEnumArrayPromise(...) resolves an already fulfilled empty enum array':
      async (testObject) => {
        const result = testObject.awaitEnumArrayPromise(Promise.resolve([]))
        expect(await withTimeout(result)).to.deep.equal([])
      },

    'awaitEnumArrayPromise(...) preserves a rejected JS Promise': async (
      testObject,
    ) => {
      const jsPromise = deferred<Powertrain[]>()
      const nativePromise = testObject.awaitEnumArrayPromise(jsPromise.promise)
      jsPromise.reject(new Error('No enum array from JS'))
      expect(await rejection(withTimeout(nativePromise)))
        .to.have.property('message')
        .that.contains('No enum array from JS')
    },
  }),
}
