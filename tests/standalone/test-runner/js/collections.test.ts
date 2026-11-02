import { expect } from 'chai'
import { casesForTestObjects, recordCallback, waitFor, rejection, withTimeout } from './utils/cases'
import { type Powertrain, type Person } from 'nitro-test'
import { HybridChild, type TestObject } from './utils/testObjects'
import { TEST_MAP, TEST_MAP_2, TEST_MAP_3, TEST_MAP_4 } from './utils/fixtures'
import { type AnyJSON } from 'nitro-core'
import { deferred } from './utils/helpers'

/**
 * The size and the first, middle and last 16 bytes of `buffer`. The native
 * buffers are 10 MB - too large to compare (and print) byte by byte.
 */
function sampleBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const middle = Math.floor(bytes.length / 2)
  return {
    byteLength: buffer.byteLength,
    first: bytes.slice(0, 16),
    middle: bytes.slice(middle, middle + 16),
    last: bytes.slice(-16),
  }
}

// Calls every array method of the spec with an empty array.
const EMPTY_ARRAY_CALLS: ReadonlyArray<[method: string, call: (testObject: TestObject) => unknown[]]> = [
  ['bounceNumbers', (testObject) => testObject.bounceNumbers([])],
  ['bounceStrings', (testObject) => testObject.bounceStrings([])],
  ['bounceStructs', (testObject) => testObject.bounceStructs([])],
  ['bounceNestedArray', (testObject) => testObject.bounceNestedArray([])],
  ['bounceEnums', (testObject) => testObject.bounceEnums([])],
  ['bounceHybridObjects', (testObject) => testObject.bounceHybridObjects([])],
  ['bounceFunctions', (testObject) => testObject.bounceFunctions([])],
  ['bounceMaps', (testObject) => testObject.bounceMaps([])],
  ['bouncePromises', (testObject) => testObject.bouncePromises([])],
  ['bounceArrayBuffers', (testObject) => testObject.bounceArrayBuffers([])],
  ['bounceOptionals', (testObject) => testObject.bounceOptionals([], [])],
  ['bounceNulls', (testObject) => testObject.bounceNulls([])],
  ['bounceOptionalNulls', (testObject) => testObject.bounceOptionalNulls([])],
]

// createMap() builds its values from these getters - seed non-default values
// so AnyJSON has to carry a true bool, a non-empty string and a negative int64.
function seedPrimitives(testObject: TestObject) {
  testObject.numberValue = 14
  testObject.boolValue = true
  testObject.stringValue = 'hello!'
  testObject.int64Value = -7362572367826385n
}

const INT64_MIN = -(2n ** 63n)

const INT64_MAX = 2n ** 63n - 1n

// An AnyJSON with objects and arrays nested a few levels deep.
const NESTED_MAP: AnyJSON = {
  level1: {
    level2: {
      level3: {
        array: [1, ['two', [true, { deepest: 'value', number: 42 }]]],
      },
      empty: {},
    },
    emptyArray: [],
  },
  mixed: [1, 'two', false, 3, [], {}],
}

function createKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `key_${i}`)
}

function getObject(value: AnyJSON): Record<string, AnyJSON> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an AnyJSON object')
  }
  return value
}

export const cases = {
  ...casesForTestObjects('Arrays', {
    'bounceNumbers(...) returns the same numbers': (testObject) => {
      expect(testObject.bounceNumbers([1, 2, 13, 42])).to.deep.equal([1, 2, 13, 42])
    },

    'bounceStrings(...) returns the same simple strings': (testObject) => {
      expect(testObject.bounceStrings(['hello', 'world', '!'])).to.deep.equal(['hello', 'world', '!'])
    },

    'bounceStrings(...) returns the same unicode/emoji strings': (testObject) => {
      expect(testObject.bounceStrings(['✨', '🔥', '🥳🥷🏼🥳'])).to.deep.equal(['✨', '🔥', '🥳🥷🏼🥳'])
    },

    'bounceOptionals(...) keeps undefined elements': (testObject) => {
      const result = testObject.bounceOptionals(['hello', undefined, 'world'], [new ArrayBuffer(16), undefined])
      expect(result).to.deep.equal(['hello', undefined, 'world'])
    },

    'bounceNulls(...) keeps null elements': (testObject) => {
      expect(testObject.bounceNulls(['hello', null, 'world'])).to.deep.equal(['hello', null, 'world'])
    },

    'bounceOptionalNulls(...) keeps null and undefined elements': (testObject) => {
      expect(testObject.bounceOptionalNulls(['hello', null, undefined])).to.deep.equal(['hello', null, undefined])
    },

    'bounceEnums(...) returns the same enum values': (testObject) => {
      expect(testObject.bounceEnums(['gas', 'hybrid'])).to.deep.equal(['gas', 'hybrid'])
    },

    'bounceStructs(...) returns the same structs': (testObject) => {
      const people = [
        { age: 24, name: 'Marc' },
        { age: 5, name: 'Ben' },
      ]
      expect(testObject.bounceStructs(people)).to.deep.equal([
        { age: 24, name: 'Marc' },
        { age: 5, name: 'Ben' },
      ])
    },

    'bounceNestedArray(...) returns the same nested arrays': (testObject) => {
      const nested = [
        [
          { age: 24, name: 'Marc' },
          { age: 5, name: 'Ben' },
        ],
        [{ age: 30, name: 'Anna' }],
        [],
      ]
      expect(testObject.bounceNestedArray(nested)).to.deep.equal([
        [
          { age: 24, name: 'Marc' },
          { age: 5, name: 'Ben' },
        ],
        [{ age: 30, name: 'Anna' }],
        [],
      ])
    },
  }),
  ...casesForTestObjects('Arrays of complex types', {
    'complexEnumCallback(...) calls back with the same enum array': async (testObject) => {
      const callback = recordCallback<(array: Powertrain[]) => void>()
      testObject.complexEnumCallback(['gas', 'electric'], callback)
      await waitFor(() => expect(callback.calls).to.have.length(1), {
        timeout: 2000,
      })
      expect(callback.calls).to.deep.include([['gas', 'electric']])
    },

    'bounceHybridObjects(...) returns the same HybridObjects in order': (testObject) => {
      const child = testObject.createChild()
      const bounced = testObject.bounceHybridObjects([HybridChild, child, HybridChild])
      expect(bounced).to.have.length(3)
      expect(Object.is(bounced[0], HybridChild)).to.equal(true)
      expect(Object.is(bounced[1], child)).to.equal(true)
      expect(Object.is(bounced[2], HybridChild)).to.equal(true)
    },

    'bounceFunctions(...) returns callable functions': async (testObject) => {
      const first = recordCallback()
      const second = recordCallback()
      const bounced = testObject.bounceFunctions([first, second])
      expect(bounced).to.have.length(2)
      for (const callback of bounced) expect(callback).to.be.a('function')

      for (const bouncedFunction of bounced) {
        bouncedFunction()
      }
      await waitFor(
        () => {
          expect(first.calls).to.have.length(1)
          expect(second.calls).to.have.length(1)
        },
        { timeout: 2000 }
      )
    },

    'bounceMaps(...) returns the same maps': (testObject) => {
      expect(testObject.bounceMaps([TEST_MAP, TEST_MAP_2])).to.deep.equal([TEST_MAP, TEST_MAP_2])
    },

    'bouncePromises(...) returns promises with the same results': async (testObject) => {
      const bounced = testObject.bouncePromises([(async () => 55)(), Promise.resolve(13)])
      expect(bounced).to.have.length(2)
      for (const promise of bounced) expect(promise).to.be.instanceOf(Promise)
      await expect(await Promise.all(bounced)).to.deep.equal([55, 13])
    },

    'bounceArrayBuffers(...) returns ArrayBuffers with the same bytes': (testObject) => {
      const jsBytes = Uint8Array.from({ length: 50 }, (_, i) => i + 1)
      const buffers = [
        testObject.createArrayBuffer(),
        testObject.createArrayBufferFromNativeBuffer(false),
        testObject.createArrayBufferFromNativeBuffer(true),
        jsBytes.buffer,
      ]
      const bounced = testObject.bounceArrayBuffers(buffers)
      expect(bounced).to.have.length(4)
      for (const buffer of bounced) expect(buffer).to.be.instanceOf(ArrayBuffer)
      expect(bounced.map(sampleBytes)).to.deep.equal(buffers.map(sampleBytes))
      expect(new Uint8Array(bounced[3]!)).to.deep.equal(jsBytes)
    },
  }),
  ...casesForTestObjects('Empty arrays', {
    'bounceNumbers(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[0]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceStrings(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[1]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceStructs(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[2]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceNestedArray(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[3]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceEnums(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[4]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceHybridObjects(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[5]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceFunctions(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[6]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceMaps(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[7]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bouncePromises(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[8]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceArrayBuffers(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[9]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceOptionals(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[10]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceNulls(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[11]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceOptionalNulls(...) returns an empty array for []': (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[12]!

      expect(call(testObject)).to.deep.equal([])
    },

    'bounceNestedArray(...) keeps empty inner arrays': (testObject) => {
      expect(testObject.bounceNestedArray([[], [], []])).to.deep.equal([[], [], []])
    },

    'complexEnumCallback(...) calls back with an empty array': async (testObject) => {
      const callback = recordCallback<(array: Powertrain[]) => void>()
      testObject.complexEnumCallback([], callback)
      await waitFor(() => expect(callback.calls).to.have.length(1), {
        timeout: 2000,
      })
      expect(callback.calls).to.deep.include([[]])
    },
  }),
  ...casesForTestObjects('Array values', {
    'bounceNumbers(...) returns a new array': (testObject) => {
      const numbers = [1, 2, 3]
      const result = testObject.bounceNumbers(numbers)
      expect(Object.is(result, numbers)).to.equal(false)
      expect(result).to.deep.equal(numbers)
    },

    'bounceNumbers(...) keeps -0': (testObject) => {
      expect(testObject.bounceNumbers([-0, 0])).to.deep.equal([-0, 0])
    },

    'bounceNumbers(...) keeps NaN and Infinity': (testObject) => {
      expect(testObject.bounceNumbers([NaN, Infinity, -Infinity])).to.deep.equal([NaN, Infinity, -Infinity])
    },

    'bounceNumbers(...) keeps extreme doubles': (testObject) => {
      const extremes = [
        Number.MAX_VALUE,
        -Number.MAX_VALUE,
        Number.MIN_VALUE,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.EPSILON,
        0.1 + 0.2,
      ]
      expect(testObject.bounceNumbers(extremes)).to.deep.equal(extremes)
    },

    'bounceNumbers(...) returns all 10,000 numbers': (testObject) => {
      const numbers = Array.from({ length: 10_000 }, (_, i) => i * 1.5 - 500)
      expect(testObject.bounceNumbers(numbers)).to.deep.equal(numbers)
    },

    'bounceStrings(...) returns all 10,000 strings': (testObject) => {
      const strings = Array.from({ length: 10_000 }, (_, i) => `string #${i}`)
      expect(testObject.bounceStrings(strings)).to.deep.equal(strings)
    },

    'bounceStrings(...) keeps empty strings': (testObject) => {
      expect(testObject.bounceStrings(['', 'a', ''])).to.deep.equal(['', 'a', ''])
    },

    'bounceStrings(...) keeps NUL characters': (testObject) => {
      expect(testObject.bounceStrings(['a\0b', '\0'])).to.deep.equal(['a\0b', '\0'])
    },

    'bounceStrings(...) keeps a 100,000 character string': (testObject) => {
      const long = 'nitro🔥!'.repeat(100_000 / 8)
      expect(testObject.bounceStrings([long])).to.deep.equal([long])
    },

    'bounceStructs(...) returns all 1,000 structs': (testObject) => {
      const people = Array.from({ length: 1_000 }, (_, i) => ({
        name: `Person #${i}`,
        age: i,
      }))
      expect(testObject.bounceStructs(people)).to.deep.equal(people)
    },

    'bounceStructs(...) drops unknown keys of each element': (testObject) => {
      const person = { name: 'Marc', age: 24, nickname: 'mrousavy' }
      expect(testObject.bounceStructs([person])).to.deep.equal([{ name: 'Marc', age: 24 }])
    },

    'bounceEnums(...) keeps duplicates and their order': (testObject) => {
      expect(testObject.bounceEnums(['hybrid', 'gas', 'hybrid', 'electric'])).to.deep.equal(['hybrid', 'gas', 'hybrid', 'electric'])
    },

    'bounceOptionals(...) keeps an array of only undefined': (testObject) => {
      expect(testObject.bounceOptionals([undefined, undefined], [])).to.deep.equal([undefined, undefined])
    },
  }),
  ...casesForTestObjects('Array conversion errors', {
    'bounceNumbers(...) rejects a number': (testObject) => {
      // @ts-expect-error passing a number instead of an array
      expect(() => testObject.bounceNumbers(5)).to.throw(
        `${testObject.constructor.name}.bounceNumbers(...): Value is a number, expected an Object`
      )
    },

    'bounceNumbers(...) rejects undefined': (testObject) => {
      // @ts-expect-error passing undefined instead of an array
      expect(() => testObject.bounceNumbers(undefined)).to.throw(
        `${testObject.constructor.name}.bounceNumbers(...): Value is undefined, expected an Object`
      )
    },

    'bounceNumbers(...) rejects an array-like object': (testObject) => {
      const arrayLike = { length: 2, 0: 1, 1: 2 }
      // @ts-expect-error passing an array-like object instead of an array
      expect(() => testObject.bounceNumbers(arrayLike)).to.throw(
        `${testObject.constructor.name}.bounceNumbers(...): Object is an object, expected an array`
      )
    },

    'bounceNumbers(...) rejects a typed array': (testObject) => {
      const typedArray = new Float64Array([1, 2])
      // @ts-expect-error passing a Float64Array instead of an array
      expect(() => testObject.bounceNumbers(typedArray)).to.throw(
        `${testObject.constructor.name}.bounceNumbers(...): Object is an object, expected an array`
      )
    },

    'bounceNumbers(...) rejects a string element': (testObject) => {
      // @ts-expect-error passing a string element
      expect(() => testObject.bounceNumbers([1, '2'])).to.throw(
        `${testObject.constructor.name}.bounceNumbers(...): Value is a string, expected a number`
      )
    },

    'bounceNumbers(...) rejects a bigint element': (testObject) => {
      // @ts-expect-error passing a bigint element
      expect(() => testObject.bounceNumbers([1, 2n])).to.throw(
        `${testObject.constructor.name}.bounceNumbers(...): Value is a bigint, expected a number`
      )
    },

    'bounceStrings(...) rejects a number element': (testObject) => {
      // @ts-expect-error passing a number element
      expect(() => testObject.bounceStrings(['a', 5])).to.throw(
        `${testObject.constructor.name}.bounceStrings(...): Value is a number, expected a String`
      )
    },

    'bounceStrings(...) rejects a null element': (testObject) => {
      // @ts-expect-error passing a null element
      expect(() => testObject.bounceStrings(['a', null])).to.throw(
        `${testObject.constructor.name}.bounceStrings(...): Value is null, expected a String`
      )
    },

    'bounceEnums(...) rejects an unknown enum value': (testObject) => {
      // @ts-expect-error passing an unknown Powertrain
      expect(() => testObject.bounceEnums(['gas', 'diesel'])).to.throw(
        `${testObject.constructor.name}.bounceEnums(...): Cannot convert "diesel" to enum Powertrain - invalid value!`
      )
    },

    'bounceEnums(...) rejects a number element': (testObject) => {
      // @ts-expect-error passing a number instead of a Powertrain
      expect(() => testObject.bounceEnums(['gas', 1])).to.throw(
        `${testObject.constructor.name}.bounceEnums(...): Value is a number, expected a String`
      )
    },

    'bounceStructs(...) rejects an element with a missing field': (testObject) => {
      // @ts-expect-error passing a Person without an age
      expect(() => testObject.bounceStructs([{ name: 'Marc' }])).to.throw(
        `${testObject.constructor.name}.bounceStructs(...): Value is undefined, expected a number`
      )
    },

    'bounceStructs(...) rejects a non-object element': (testObject) => {
      // @ts-expect-error passing a string instead of a Person
      expect(() => testObject.bounceStructs(['Marc'])).to.throw(
        `${testObject.constructor.name}.bounceStructs(...): Value is a string, expected an Object`
      )
    },

    'bounceNestedArray(...) rejects a struct instead of an inner array': (testObject) => {
      const person = { name: 'Marc', age: 24 }
      // @ts-expect-error passing a Person instead of Person[]
      expect(() => testObject.bounceNestedArray([[person], person])).to.throw(
        `${testObject.constructor.name}.bounceNestedArray(...): Object is an object, expected an array`
      )
    },

    'bounceOptionals(...) rejects null elements': (testObject) => {
      // @ts-expect-error passing null where only undefined is optional
      expect(() => testObject.bounceOptionals(['a', null], [])).to.throw(
        `${testObject.constructor.name}.bounceOptionals(...): Value is null, expected a String`
      )
    },

    'bounceNulls(...) rejects undefined elements': (testObject) => {
      // @ts-expect-error passing undefined where only null is allowed
      expect(() => testObject.bounceNulls(['a', undefined])).to.throw(
        `${testObject.constructor.name}.bounceNulls(...): Cannot convert "undefined" to any type in variant<`
      )
    },

    'bounceOptionalNulls(...) rejects a number element': (testObject) => {
      // @ts-expect-error passing a number element
      expect(() => testObject.bounceOptionalNulls(['a', 5])).to.throw(
        `${testObject.constructor.name}.bounceOptionalNulls(...): Cannot convert "5" to any type in variant<`
      )
    },

    'bounceFunctions(...) rejects a non-function element': (testObject) => {
      // @ts-expect-error passing an object instead of a function
      expect(() => testObject.bounceFunctions([() => {}, {}])).to.throw(
        `${testObject.constructor.name}.bounceFunctions(...): Object is an object, expected a function`
      )
    },
  }),
  ...casesForTestObjects('AnyJSON', {
    'createMap() contains every value type': (testObject) => {
      seedPrimitives(testObject)
      const result = getObject(testObject.createMap())
      expect(result.array).to.be.instanceOf(Array)
      expect(result.object).to.be.an('object')
      expect(result).to.deep.equal({
        number: 14,
        bool: true,
        string: 'hello!',
        int64: Number(-7362572367826385n),
        null: null,
        array: result.array,
        object: result.object,
      })
    },

    'createMap().array contains every value type': (testObject) => {
      seedPrimitives(testObject)
      expect(getObject(testObject.createMap()).array).to.deep.equal([
        testObject.numberValue,
        testObject.boolValue,
        testObject.stringValue,
        Number(testObject.int64Value),
      ])
    },

    'createMap().object contains every value type': (testObject) => {
      seedPrimitives(testObject)
      const values = [testObject.numberValue, testObject.boolValue, testObject.stringValue, Number(testObject.int64Value)]
      expect(getObject(testObject.createMap()).object).to.deep.equal({
        array: [...values, values],
        int64: Number(testObject.int64Value),
        bool: testObject.boolValue,
        string: testObject.stringValue,
        number: testObject.numberValue,
        null: null,
      })
    },

    'mapRoundtrip(...) returns an equal map': (testObject) => {
      seedPrimitives(testObject)
      const map = testObject.createMap()
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map)
    },

    'getMapKeys(...) returns all keys': (testObject) => {
      seedPrimitives(testObject)
      const map = testObject.createMap()
      const keys = testObject.getMapKeys(map)
      expect([...keys].sort()).to.deep.equal(Object.keys(getObject(map)).sort())
    },

    'mergeMaps(...) merges both maps': (testObject) => {
      expect(testObject.mergeMaps(TEST_MAP, TEST_MAP_2)).to.deep.equal({
        ...TEST_MAP,
        ...TEST_MAP_2,
      })
    },

    'copyAnyMap(...) rejects a map containing bigint': (testObject) => {
      // @ts-expect-error BigInt is not a JSON value.
      expect(() => testObject.copyAnyMap(TEST_MAP_4)).to.throw()
    },
  }),
  ...casesForTestObjects('Typed maps', {
    'bounceMap(...) returns an equal map': (testObject) => {
      expect(testObject.bounceMap(TEST_MAP)).to.deep.equal(TEST_MAP)
    },

    'bounceSimpleMap(...) returns an equal map': (testObject) => {
      expect(testObject.bounceSimpleMap(TEST_MAP_3)).to.deep.equal(TEST_MAP_3)
    },

    'bounceOptionalMap(...) keeps undefined values': (testObject) => {
      expect(testObject.bounceOptionalMap({ a: 'b', c: undefined })).to.deep.equal({ a: 'b', c: undefined })
    },

    'bounceNullMap(...) keeps null values': (testObject) => {
      expect(testObject.bounceNullMap({ a: 'b', c: null })).to.deep.equal({
        a: 'b',
        c: null,
      })
    },

    'bounceOptionalNullMap(...) keeps null and undefined values': (testObject) => {
      expect(testObject.bounceOptionalNullMap({ a: 'b', b: null, c: undefined })).to.deep.equal({ a: 'b', b: null, c: undefined })
    },

    'extractMap(...) returns mapWrapper.map': (testObject) => {
      expect(
        testObject.extractMap({
          map: TEST_MAP_2,
          secondMap: { second: TEST_MAP_2 },
        })
      ).to.deep.equal(TEST_MAP_2)
    },
  }),
  ...casesForTestObjects('AnyJSON values', {
    'mapRoundtrip(...) keeps a integer number value': (testObject) => {
      const value = 55

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) keeps a fractional number value': (testObject) => {
      const value = -13.37

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) keeps a true value': (testObject) => {
      const value = true

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) keeps a false value': (testObject) => {
      const value = false

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) keeps a string value': (testObject) => {
      const value = 'hello'

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) keeps a empty string value': (testObject) => {
      const value = ''

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) keeps a null value': (testObject) => {
      const value = null

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) rejects a bigint value': (testObject) => {
      const value = 1234567890123n

      // @ts-expect-error BigInt is not a JSON value.
      expect(() => testObject.mapRoundtrip({ value: value })).to.throw()
    },

    'mapRoundtrip(...) rejects a negative bigint value': (testObject) => {
      const value = -55n

      // @ts-expect-error BigInt is not a JSON value.
      expect(() => testObject.mapRoundtrip({ value: value })).to.throw()
    },

    'mapRoundtrip(...) keeps a empty array value': (testObject) => {
      const value: AnyJSON[] = []

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) keeps a empty object value': (testObject) => {
      const value = {}

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      })
    },

    'mapRoundtrip(...) rejects the int64 boundaries as bigints': (testObject) => {
      expect(() =>
        // @ts-expect-error BigInt is not a JSON value.
        testObject.mapRoundtrip({ min: INT64_MIN, max: INT64_MAX })
      ).to.throw()
    },

    'mapRoundtrip(...) keeps numbers beyond 2^53 as numbers': (testObject) => {
      const map = { big: 2 ** 64, max: Number.MAX_VALUE }
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map)
    },

    'mapRoundtrip(...) keeps nested objects and arrays': (testObject) => {
      expect(testObject.mapRoundtrip(NESTED_MAP)).to.deep.equal(NESTED_MAP)
    },

    'mapRoundtrip(...) keeps null inside arrays': (testObject) => {
      const map = { array: [null, 1, null] }
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map)
    },

    'mapRoundtrip(...) keeps null inside objects': (testObject) => {
      const map = { object: { a: null, b: 1 } }
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map)
    },

    'copyAnyMap(...) keeps nested objects and arrays': (testObject) => {
      expect(testObject.copyAnyMap(NESTED_MAP)).to.deep.equal(NESTED_MAP)
    },

    'copyAnyMap(...) keeps null inside arrays': (testObject) => {
      const map = { array: [null, 1, null] }
      expect(testObject.copyAnyMap(map)).to.deep.equal(map)
    },

    'copyAnyMap(...) keeps null inside objects': (testObject) => {
      const map = { object: { a: null, b: 1 } }
      expect(testObject.copyAnyMap(map)).to.deep.equal(map)
    },

    'copyAnyMap(...) rejects the int64 boundaries as bigints': (testObject) => {
      expect(() =>
        // @ts-expect-error BigInt is not a JSON value.
        testObject.copyAnyMap({ min: INT64_MIN, max: INT64_MAX })
      ).to.throw()
    },

    'mapRoundtrip(...) returns a new object': (testObject) => {
      const map = { a: 1 }
      expect(Object.is(testObject.mapRoundtrip(map), map)).to.equal(false)
    },
  }),
  ...casesForTestObjects('AnyJSON keys', {
    'mapRoundtrip(...) returns {} for an empty map': (testObject) => {
      expect(testObject.mapRoundtrip({})).to.deep.equal({})
    },

    'copyAnyMap(...) returns {} for an empty map': (testObject) => {
      expect(testObject.copyAnyMap({})).to.deep.equal({})
    },

    'getMapKeys(...) returns [] for an empty map': (testObject) => {
      expect(testObject.getMapKeys({})).to.deep.equal([])
    },

    'mapRoundtrip(...) keeps 1,000 keys': (testObject) => {
      const map = Object.fromEntries(createKeys(1_000).map((key, i) => [key, i]))
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map)
    },

    'getMapKeys(...) returns each of 1,000 keys once': (testObject) => {
      const keys = createKeys(1_000)
      const map = Object.fromEntries(keys.map((key) => [key, true]))
      expect([...testObject.getMapKeys(map)].sort()).to.deep.equal([...keys].sort())
    },

    'mapRoundtrip(...) keeps unicode keys': (testObject) => {
      const map = { '🔥': 1, 'ключ': 'значение', '日本語': true }
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map)
    },

    'mapRoundtrip(...) keeps an empty string key': (testObject) => {
      expect(testObject.mapRoundtrip({ '': 'empty' })).to.deep.equal({
        '': 'empty',
      })
    },

    'mapRoundtrip(...) keeps numeric keys': (testObject) => {
      const map = { 0: 'zero', 42: 'answer' }
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map)
    },
  }),
  ...casesForTestObjects('AnyJSON merging', {
    'mergeMaps(...) returns {} for two empty maps': (testObject) => {
      expect(testObject.mergeMaps({}, {})).to.deep.equal({})
    },

    'mergeMaps(...) returns the first map for an empty second map': (testObject) => {
      expect(testObject.mergeMaps({ a: 1, b: 'b' }, {})).to.deep.equal({
        a: 1,
        b: 'b',
      })
    },

    'mergeMaps(...) returns the second map for an empty first map': (testObject) => {
      expect(testObject.mergeMaps({}, { a: 1, b: 'b' })).to.deep.equal({
        a: 1,
        b: 'b',
      })
    },

    'mergeMaps(...) prefers values of the second map': (testObject) => {
      expect(testObject.mergeMaps({ a: 1, shared: 2 }, { shared: 3, b: 4 })).to.deep.equal({ a: 1, shared: 3, b: 4 })
    },

    'mergeMaps(...) replaces a value with one of a different type': (testObject) => {
      expect(testObject.mergeMaps({ shared: 1 }, { shared: [1, 'one'] })).to.deep.equal({ shared: [1, 'one'] })
    },

    'mergeMaps(...) replaces nested objects instead of merging them': (testObject) => {
      expect(testObject.mergeMaps({ nested: { a: 1, b: 2 } }, { nested: { b: 3 } })).to.deep.equal({ nested: { b: 3 } })
    },
  }),
  ...casesForTestObjects('AnyJSON serialization', {
    'mapRoundtrip(...) accepts a number': (testObject) => {
      expect(testObject.mapRoundtrip(5)).to.equal(5)
    },

    'mapRoundtrip(...) omits undefined object properties': (testObject) => {
      // @ts-expect-error Undefined is not a declared JSON value.
      const result = testObject.mapRoundtrip({ keep: 1, a: undefined })
      expect(result).to.deep.equal({ keep: 1 })
    },

    'mapRoundtrip(...) converts undefined array elements to null': (testObject) => {
      // @ts-expect-error Undefined is not a declared JSON value.
      const result = testObject.mapRoundtrip({ a: [1, undefined] })
      expect(result).to.deep.equal({ a: [1, null] })
    },

    'mapRoundtrip(...) omits function object properties': (testObject) => {
      // @ts-expect-error Functions are not declared JSON values.
      const result = testObject.mapRoundtrip({ keep: 1, a: () => {} })
      expect(result).to.deep.equal({ keep: 1 })
    },

    'mapRoundtrip(...) omits symbol object properties': (testObject) => {
      // @ts-expect-error Symbols are not declared JSON values.
      const result = testObject.mapRoundtrip({ keep: 1, a: Symbol('a') })
      expect(result).to.deep.equal({ keep: 1 })
    },

    'mapRoundtrip(...) converts functions and symbols in arrays to null': (testObject) => {
      // @ts-expect-error Functions and symbols are not declared JSON values.
      const result = testObject.mapRoundtrip([1, () => {}, Symbol('a')])
      expect(result).to.deep.equal([1, null, null])
    },

    'mapRoundtrip(...) converts nonfinite numbers to null': (testObject) => {
      expect(testObject.mapRoundtrip({ a: NaN, b: Infinity, c: -Infinity })).to.deep.equal({ a: null, b: null, c: null })
      expect(testObject.mapRoundtrip([NaN, Infinity, -Infinity])).to.deep.equal([null, null, null])
      expect(testObject.mapRoundtrip(NaN)).to.equal(null)
    },

    'mapRoundtrip(...) serializes ArrayBuffer values as empty objects': (testObject) => {
      // @ts-expect-error ArrayBuffer is not a declared JSON value.
      const result = testObject.mapRoundtrip({ a: new ArrayBuffer(8) })
      expect(result).to.deep.equal({ a: {} })
    },

    'mapRoundtrip(...) rejects a bigint beyond int64': (testObject) => {
      // @ts-expect-error BigInt is not a JSON value.
      expect(() => testObject.mapRoundtrip({ a: INT64_MAX + 1n })).to.throw()
      expect(testObject.mapRoundtrip({ valid: true })).to.deep.equal({
        valid: true,
      })
    },

    'mapRoundtrip(...) rejects circular objects': (testObject) => {
      const circular: Record<string, AnyJSON> = {}
      circular.self = circular
      expect(() => testObject.mapRoundtrip(circular)).to.throw()
      expect(testObject.mapRoundtrip({ valid: true })).to.deep.equal({
        valid: true,
      })
    },

    'mapRoundtrip(...) rejects circular arrays': (testObject) => {
      const circular: AnyJSON[] = []
      circular.push(circular)
      expect(() => testObject.mapRoundtrip(circular)).to.throw()
      expect(testObject.mapRoundtrip([])).to.deep.equal([])
    },

    'mapRoundtrip(...) rejects top-level undefined, functions and symbols': (testObject) => {
      // @ts-expect-error Undefined is not a JSON value.
      expect(() => testObject.mapRoundtrip(undefined)).to.throw()
      // @ts-expect-error Functions are not JSON values.
      expect(() => testObject.mapRoundtrip(() => {})).to.throw()
      // @ts-expect-error Symbols are not JSON values.
      expect(() => testObject.mapRoundtrip(Symbol('a'))).to.throw()
      expect(testObject.mapRoundtrip(null)).to.equal(null)
    },
  }),
  ...casesForTestObjects('Typed map edge cases', {
    'bounceSimpleMap(...) returns {} for an empty map': (testObject) => {
      expect(testObject.bounceSimpleMap({})).to.deep.equal({})
    },

    'bounceSimpleMap(...) keeps 1,000 keys': (testObject) => {
      const map = Object.fromEntries(createKeys(1_000).map((key, i) => [key, i]))
      expect(testObject.bounceSimpleMap(map)).to.deep.equal(map)
    },

    'bounceSimpleMap(...) keeps unicode keys': (testObject) => {
      const map = { '🔥': 1, 'ключ': 2, '日本語': 3 }
      expect(testObject.bounceSimpleMap(map)).to.deep.equal(map)
    },

    'bounceMap(...) keeps booleans and numbers apart': (testObject) => {
      const map = { zero: 0, one: 1, no: false, yes: true }
      expect(testObject.bounceMap(map)).to.deep.equal(map)
    },

    'extractMap(...) returns {} for an empty map': (testObject) => {
      expect(testObject.extractMap({ map: {}, secondMap: { second: {} } })).to.deep.equal({})
    },

    'bounceSimpleMap(...) rejects a number': (testObject) => {
      // @ts-expect-error passing a number instead of a map
      expect(() => testObject.bounceSimpleMap(5)).to.throw(
        `${testObject.constructor.name}.bounceSimpleMap(...): Value is a number, expected an Object`
      )
    },

    'bounceSimpleMap(...) rejects a string value': (testObject) => {
      // @ts-expect-error passing a string value
      expect(() => testObject.bounceSimpleMap({ a: 1, b: '2' })).to.throw(
        `${testObject.constructor.name}.bounceSimpleMap(...): Value is a string, expected a number`
      )
    },

    'bounceMap(...) rejects a string value': (testObject) => {
      // @ts-expect-error passing a string value
      expect(() => testObject.bounceMap({ a: 'yes' })).to.throw(
        `${testObject.constructor.name}.bounceMap(...): Cannot convert "yes" to any type in variant<`
      )
    },

    'bounceOptionalMap(...) rejects null values': (testObject) => {
      // @ts-expect-error passing null where only undefined is optional
      expect(() => testObject.bounceOptionalMap({ a: null })).to.throw(
        `${testObject.constructor.name}.bounceOptionalMap(...): Value is null, expected a String`
      )
    },

    'bounceNullMap(...) rejects undefined values': (testObject) => {
      // @ts-expect-error passing undefined where only null is allowed
      expect(() => testObject.bounceNullMap({ a: undefined })).to.throw(
        `${testObject.constructor.name}.bounceNullMap(...): Cannot convert "undefined" to any type in variant<`
      )
    },

    'extractMap(...) rejects a missing secondMap': (testObject) => {
      // @ts-expect-error passing a MapWrapper without secondMap
      expect(() => testObject.extractMap({ map: {} })).to.throw(
        `${testObject.constructor.name}.extractMap(...): Value is undefined, expected an Object`
      )
    },
  }),
  ...casesForTestObjects('Native container callbacks', {
    'callEnumArrayCallback(...) passes native enums to JS and returns the JS array': (testObject) => {
      const received: Powertrain[][] = []
      const result = testObject.callEnumArrayCallback(['gas', 'hybrid'], (array) => {
        received.push(array)
        return ['electric', ...array]
      })
      expect(received).to.deep.equal([['gas', 'hybrid']])
      expect(result).to.deep.equal(['electric', 'gas', 'hybrid'])
    },

    'callEnumArrayCallback(...) accepts an empty returned enum array': (testObject) => {
      const result = testObject.callEnumArrayCallback(['hybrid'], () => [])
      expect(result).to.deep.equal([])
    },

    'callEnumArrayCallback(...) propagates a thrown JS error': (testObject) => {
      expect(() =>
        testObject.callEnumArrayCallback(['gas'], () => {
          throw new Error('Enum array callback failed')
        })
      ).to.throw('Enum array callback failed')
    },

    'getEnumArrayCallback() returns a native callback callable from JS': (testObject) => {
      const callback = testObject.getEnumArrayCallback()
      expect(callback(['electric', 'gas', 'electric'])).to.deep.equal(['electric', 'gas', 'electric'])
      expect(callback([])).to.deep.equal([])
    },

    'callNestedStructCallback(...) keeps nested arrays, optional structs and callback results': (testObject) => {
      const input: (Person | undefined)[][] = [[{ name: 'Marc', age: 24 }, undefined], [], [undefined, { name: 'Ben', age: 5 }]]
      const replacement: (Person | undefined)[][] = [[undefined], [{ name: 'Alice', age: 31 }]]
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
    "callEnumArrayPromiseCallback(...) awaits the JS callback's enum array Promise": async (testObject) => {
      let calls = 0
      const result = await withTimeout(
        testObject.callEnumArrayPromiseCallback(async () => {
          calls += 1
          await Promise.resolve()
          return ['gas', 'electric']
        })
      )
      expect(calls).to.equal(1)
      expect(result).to.deep.equal(['gas', 'electric'])
    },

    'callEnumArrayPromiseCallback(...) rejects when the JS Promise rejects': async (testObject) => {
      const result = testObject.callEnumArrayPromiseCallback(() => Promise.reject(new Error('Enum array Promise failed')))
      expect(await rejection(withTimeout(result)))
        .to.have.property('message')
        .that.contains('Enum array Promise failed')
    },

    'callEnumArrayPromiseCallback(...) rejects when the JS callback throws': async (testObject) => {
      const result = testObject.callEnumArrayPromiseCallback(() => {
        throw new Error('Enum array Promise callback failed')
      })
      expect(await rejection(withTimeout(result)))
        .to.have.property('message')
        .that.contains('Enum array Promise callback failed')
    },

    'awaitEnumArrayPromise(...) resolves a pending JS Promise through a native Promise': async (testObject) => {
      const jsPromise = deferred<Powertrain[]>()
      const nativePromise = testObject.awaitEnumArrayPromise(jsPromise.promise)
      jsPromise.resolve(['hybrid', 'electric', 'gas'])
      expect(await withTimeout(nativePromise)).to.deep.equal(['hybrid', 'electric', 'gas'])
    },

    'awaitEnumArrayPromise(...) resolves an already fulfilled empty enum array': async (testObject) => {
      const result = testObject.awaitEnumArrayPromise(Promise.resolve([]))
      expect(await withTimeout(result)).to.deep.equal([])
    },

    'awaitEnumArrayPromise(...) preserves a rejected JS Promise': async (testObject) => {
      const jsPromise = deferred<Powertrain[]>()
      const nativePromise = testObject.awaitEnumArrayPromise(jsPromise.promise)
      jsPromise.reject(new Error('No enum array from JS'))
      expect(await rejection(withTimeout(nativePromise)))
        .to.have.property('message')
        .that.contains('No enum array from JS')
    },
  }),
}
