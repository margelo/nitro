import { expect } from 'chai'
import { casesForTestObjects, recordCallback, waitFor, namedCases, rejection, withTimeout } from './utils/cases'
import { type Car, type OptionalWrapper, type UnsignedValues, TestObjectCpp } from 'nitro-test'
import { sumUpAllPassengers, TEST_CAR, TEST_CAR_2, TEST_OPTIONAL_ENUM_WRAPPER, TEST_PERSON, TEST_WRAPPED_STRUCT } from './utils/fixtures'
import { type AnyJSON } from 'nitro-core'

const UNSIGNED_BOUNDARIES = [0n, 1n, 9223372036854775807n, 9223372036854775808n, 18446744073709551615n]

const CAR_WITHOUT_DRIVER: Car = {
  make: 'Lamborghini',
  year: 2018,
  model: 'Huracan Performante',
  power: 640,
  passengers: [],
  powertrain: 'gas',
  isFast: true,
  performanceScores: [100, 0],
}

// TEST_OPTIONAL_WRAPPER's buffer is all zeros - use distinct bytes instead.
const OPTIONAL_WRAPPER_BYTES = Uint8Array.from({ length: 1024 }, (_, i) => i % 256)

const OPTIONAL_WRAPPER: OptionalWrapper = {
  optionalArrayBuffer: OPTIONAL_WRAPPER_BYTES.buffer,
  optionalString: 'hello!',
}

// Every key of `OptionalEnumWrapper`, all set to `undefined`.
const EMPTY_OPTIONAL_ENUM_WRAPPER = Object.fromEntries(Object.keys(TEST_OPTIONAL_ENUM_WRAPPER).map((key) => [key, undefined]))

/**
 * Returns a copy of `value` without `key` - to pass a struct with a missing
 * required field.
 */
function withoutKey<T extends object>(value: T, key: keyof T): Partial<T> {
  const copy = { ...value }
  delete copy[key]
  return copy
}

interface JSONTextCase {
  label: string
  json: string
  value: AnyJSON
}

const JSON_TEXT_CASES: readonly JSONTextCase[] = [
  { label: 'null', json: 'null', value: null },
  { label: 'true', json: 'true', value: true },
  { label: 'false', json: 'false', value: false },
  { label: 'zero', json: '0', value: 0 },
  { label: 'negative integer', json: '-42', value: -42 },
  { label: 'fraction', json: '-13.37', value: -13.37 },
  { label: 'exponent', json: '1.25e3', value: 1250 },
  {
    label: 'maximum safe integer',
    json: '9007199254740991',
    value: Number.MAX_SAFE_INTEGER,
  },
  { label: 'small positive exponent', json: '1e-100', value: 1e-100 },
  { label: 'large positive exponent', json: '1e100', value: 1e100 },
  {
    label: 'whitespace around a scalar',
    json: ' \n\t -12.5 \r\n',
    value: -12.5,
  },
  { label: 'string', json: '"hello"', value: 'hello' },
  { label: 'empty string', json: '""', value: '' },
  { label: 'empty array', json: '[]', value: [] },
  { label: 'empty object', json: '{}', value: {} },
  {
    label: 'unicode keys and values',
    json: '{"🔥":"日本語","ключ":"значение","escaped":"\\uD83D\\uDD25"}',
    value: { '🔥': '日本語', 'ключ': 'значение', 'escaped': '🔥' },
  },
  {
    label: 'lone high surrogate',
    json: '"\\uD800"',
    value: '\uD800',
  },
  {
    label: 'lone low surrogate',
    json: '"\\uDFFF"',
    value: '\uDFFF',
  },
  {
    label: 'lone surrogates in nested values and object keys',
    json: '{"\\uD800":{"value":"\\uDFFF","items":["\\uD800"]}}',
    value: { '\uD800': { value: '\uDFFF', items: ['\uD800'] } },
  },
  {
    label: 'escaped characters',
    json: String.raw`"\"quoted\"\\path\n\r\t\b\f\u0000"`,
    value: '"quoted"\\path\n\r\t\b\f\u0000',
  },
  {
    label: 'nested arrays and objects',
    json: '[null,true,1,"two",[],{},[{"nested":[false,{"empty":{},"array":[]}]}]]',
    value: [null, true, 1, 'two', [], {}, [{ nested: [false, { empty: {}, array: [] }] }]],
  },
]

const INVALID_JSON = [
  '',
  '{',
  '[1,]',
  '{"missing":}',
  '{"key":1} trailing',
  '"unterminated',
  '"raw\nnewline"',
  'undefined',
  'NaN',
  'Infinity',
]

const JSON_PARSE_ERROR = /JSON parse error|SyntaxError|unexpected|unterminated|invalid JSON/i

async function expectJSONRejection(promise: Promise<AnyJSON>): Promise<void> {
  // A timeout rejects the test itself; it cannot become the expected rejection.
  const error = await withTimeout(rejection(promise))
  if (!(error instanceof Error)) {
    throw new Error('Expected a JSON parse Error from the native Promise')
  }
  expect(error.message).to.match(JSON_PARSE_ERROR)
}

export const cases = {
  ...casesForTestObjects('Unsigned struct roundtrips', {
    'roundtripUnsignedScalar preserves all 64 bits': (testObject) => {
      for (const unsigned of UNSIGNED_BOUNDARIES) {
        expect(testObject.roundtripUnsignedScalar({ value: unsigned })).to.deep.equal({ value: unsigned })
      }
    },

    'roundtripUnsignedValues preserves values in containers and callbacks': (testObject) => {
      for (const unsigned of UNSIGNED_BOUNDARIES) {
        for (const optionalUnsigned of [undefined, ...UNSIGNED_BOUNDARIES]) {
          const input: UnsignedValues = {
            unsignedValue: unsigned,
            optionalUnsigned: optionalUnsigned,
            values: UNSIGNED_BOUNDARIES,
            nested: [[], UNSIGNED_BOUNDARIES, [unsigned]],
            record: { missing: undefined, value: unsigned, maximum: UNSIGNED_BOUNDARIES.at(-1) },
            callbacks: [(value) => value],
          }
          const result = testObject.roundtripUnsignedValues(input)
          expect(result.unsignedValue).to.equal(unsigned)
          expect(result.optionalUnsigned).to.equal(optionalUnsigned)
          expect(result.values).to.deep.equal(UNSIGNED_BOUNDARIES)
          expect(result.nested).to.deep.equal(input.nested)
          expect(result.record).to.deep.equal(input.record)
          expect(result.callbacks[0]?.(unsigned)).to.equal(unsigned)
        }
      }
    },
  }),
  ...casesForTestObjects('Unsigned containers', {
    'bounceUnsignedArray(...) preserves all 64 bits': (testObject) => {
      expect(testObject.bounceUnsignedArray(UNSIGNED_BOUNDARIES)).to.deep.equal(UNSIGNED_BOUNDARIES)
      expect(testObject.bounceUnsignedArray([])).to.deep.equal([])
    },

    'bounceNestedUnsignedArray(...) preserves every level': (testObject) => {
      const nested = [[], UNSIGNED_BOUNDARIES, [18446744073709551615n]]
      expect(testObject.bounceNestedUnsignedArray(nested)).to.deep.equal(nested)
    },

    'bounceOptionalUnsignedArray(...) preserves a missing and a present array': (testObject) => {
      expect(testObject.bounceOptionalUnsignedArray(undefined)).to.equal(undefined)
      expect(testObject.bounceOptionalUnsignedArray(UNSIGNED_BOUNDARIES)).to.deep.equal(UNSIGNED_BOUNDARIES)
    },

    'bounceUnsignedArrayAsync(...) resolves all 64 bits': async (testObject) => {
      const result = await withTimeout(testObject.bounceUnsignedArrayAsync(UNSIGNED_BOUNDARIES))
      expect(result).to.deep.equal(UNSIGNED_BOUNDARIES)
    },

    'callUnsignedArrayCallback(...) passes all 64 bits to JS and back': (testObject) => {
      const received: bigint[][] = []
      const result = testObject.callUnsignedArrayCallback(UNSIGNED_BOUNDARIES, (array) => {
        received.push(array)
        return [...array].reverse()
      })
      expect(received).to.deep.equal([UNSIGNED_BOUNDARIES])
      expect(result).to.deep.equal([...UNSIGNED_BOUNDARIES].reverse())
    },

    'bounceUnsignedVariant(...) preserves all 64 bits and strings': (testObject) => {
      for (const unsigned of UNSIGNED_BOUNDARIES) {
        expect(testObject.bounceUnsignedVariant(unsigned)).to.equal(unsigned)
      }
      expect(testObject.bounceUnsignedVariant('18446744073709551615')).to.equal('18446744073709551615')
    },

    'bounceUnsignedArrayVariant(...) preserves arrays and strings': (testObject) => {
      expect(testObject.bounceUnsignedArrayVariant(UNSIGNED_BOUNDARIES)).to.deep.equal(UNSIGNED_BOUNDARIES)
      expect(testObject.bounceUnsignedArrayVariant([])).to.deep.equal([])
      expect(testObject.bounceUnsignedArrayVariant('values')).to.equal('values')
    },

    'bounceUnsignedMap(...) preserves all 64 bits': (testObject) => {
      const map = { zero: 0n, signedMaximum: 9223372036854775807n, unsignedHalf: 9223372036854775808n, maximum: 18446744073709551615n }
      expect(testObject.bounceUnsignedMap(map)).to.deep.equal(map)
      expect(testObject.bounceUnsignedMap({})).to.deep.equal({})
    },

    'bounceUnsignedArrayMap(...) preserves arrays of all 64 bits': (testObject) => {
      const map = { empty: [], boundaries: UNSIGNED_BOUNDARIES }
      expect(testObject.bounceUnsignedArrayMap(map)).to.deep.equal(map)
    },

    'bounceUnsignedAsync(...) resolves all 64 bits': async (testObject) => {
      for (const unsigned of UNSIGNED_BOUNDARIES) {
        expect(await withTimeout(testObject.bounceUnsignedAsync(unsigned))).to.equal(unsigned)
      }
    },

    'callUnsignedCallbackAsync(...) resolves the JS result': async (testObject) => {
      const result = await withTimeout(testObject.callUnsignedCallbackAsync(9223372036854775808n, (value) => value * 2n - 1n))
      expect(result).to.equal(18446744073709551615n)
    },

    'callUnsignedArrayCallbackAsync(...) resolves the JS array': async (testObject) => {
      const result = await withTimeout(testObject.callUnsignedArrayCallbackAsync(UNSIGNED_BOUNDARIES, (array) => [...array].reverse()))
      expect(result).to.deep.equal([...UNSIGNED_BOUNDARIES].reverse())
    },
  }),
  ...casesForTestObjects('Struct roundtrips', {
    'bouncePartialStruct(...) keeps an empty struct': (testObject) => {
      expect(testObject.bouncePartialStruct({ name: undefined, age: undefined })).to.deep.equal({ name: undefined, age: undefined })
    },

    'bouncePartialStruct(...) keeps a struct with 1 key': (testObject) => {
      expect(testObject.bouncePartialStruct({ name: 'Marc', age: undefined })).to.deep.equal({ name: 'Marc', age: undefined })
    },

    'bouncePartialStruct(...) keeps a struct with all keys': (testObject) => {
      expect(testObject.bouncePartialStruct({ name: 'Marc', age: 25 })).to.deep.equal({ name: 'Marc', age: 25 })
    },

    'bounceWrappedJsStyleStruct(...) returns the same struct': (testObject) => {
      const result = testObject.bounceWrappedJsStyleStruct(TEST_WRAPPED_STRUCT)
      expect(result.value.onChanged).to.be.a('function')
      expect(result).to.deep.equal({
        value: { value: 55.3, onChanged: result.value.onChanged },
        items: [],
      })
    },

    'bounceOptionalWrapper(...) returns the same struct': (testObject) => {
      const result = testObject.bounceOptionalWrapper(OPTIONAL_WRAPPER)
      // Failure messages print an ArrayBuffer as '', so compare its bytes first
      expect(new Uint8Array(result.optionalArrayBuffer ?? [])).to.deep.equal(OPTIONAL_WRAPPER_BYTES)
      // Compare the bytes as well as every optional wrapper field.
      expect(result).to.deep.equal(OPTIONAL_WRAPPER)
    },

    'bounceOptionalEnumStruct(...) returns the same struct': (testObject) => {
      expect(testObject.bounceOptionalEnumStruct(TEST_OPTIONAL_ENUM_WRAPPER)).to.deep.equal(TEST_OPTIONAL_ENUM_WRAPPER)
    },

    'bounceOptionalEnumStruct(...) returns undefined for undefined': (testObject) => {
      expect(testObject.bounceOptionalEnumStruct(undefined)).to.equal(undefined)
    },

    'bounceOptionalCallback(...) returns a callable function': async (testObject) => {
      const callback = recordCallback()
      const bounced = testObject.bounceOptionalCallback({ callback }).callback
      expect(bounced).to.be.a('function')
      const call = bounced as () => void
      call()
      await waitFor(() => expect(callback.calls).to.have.length(1), {
        timeout: 2000,
      })
    },

    'bounceOptionalCallback(...) returns a number': (testObject) => {
      expect(Object.is(testObject.bounceOptionalCallback({ callback: 55 }).callback, 55)).to.equal(true)
    },

    'bounceOptionalCallback(...) returns undefined for a missing callback': (testObject) => {
      expect(testObject.bounceOptionalCallback({}).callback).to.equal(undefined)
    },
  }),
  ...casesForTestObjects('Car and Person structs', {
    'getCar() returns a Car with every key': (testObject) => {
      expect(testObject.getCar()).to.deep.equal({
        year: 2018,
        make: 'Lamborghini',
        model: testObject.constructor.name === 'TestObjectCpp' ? 'Huracan Performante' : 'Huracán',
        power: 640,
        powertrain: 'gas',
        driver: undefined,
        passengers: [],
        isFast: true,
        favouriteTrack: undefined,
        performanceScores: [100, 10],
        someVariant: undefined,
      })
    },

    'sumUpAllPassengers(...) joins all passengers': (testObject) => {
      expect(Object.is(testObject.sumUpAllPassengers([TEST_CAR, TEST_CAR_2]), sumUpAllPassengers([TEST_CAR, TEST_CAR_2]))).to.equal(true)
    },

    'isCarElectric(...) returns false for a gas car': (testObject) => {
      expect(Object.is(testObject.isCarElectric(CAR_WITHOUT_DRIVER), false)).to.equal(true)
    },

    'areCarsEqual(...) returns true for the same car': (testObject) => {
      expect(Object.is(testObject.areCarsEqual(TEST_CAR, TEST_CAR), true)).to.equal(true)
    },

    'areCarsEqual(...) returns false for different cars': (testObject) => {
      expect(Object.is(testObject.areCarsEqual(TEST_CAR, TEST_CAR_2), false)).to.equal(true)
    },

    'getDriver(...) returns undefined without a driver': (testObject) => {
      expect(testObject.getDriver(CAR_WITHOUT_DRIVER)).to.equal(undefined)
    },

    'getDriver(...) returns the driver': (testObject) => {
      expect(
        testObject.getDriver({
          ...CAR_WITHOUT_DRIVER,
          driver: { age: 24, name: 'marc' },
        })
      ).to.deep.equal({ age: 24, name: 'marc' })
    },

    'bounceCar(...) returns the same TEST_CAR': (testObject) => {
      expect(testObject.bounceCar(TEST_CAR)).to.deep.equal(TEST_CAR)
    },

    'bounceCar(...) returns the same TEST_CAR_2': (testObject) => {
      expect(testObject.bounceCar(TEST_CAR_2)).to.deep.equal(TEST_CAR_2)
    },

    'jsStyleObjectAsParameters(...) calls onChanged with the value': async (testObject) => {
      const onChanged = recordCallback<(num: number) => void>()
      testObject.jsStyleObjectAsParameters({ value: 55, onChanged })
      await waitFor(() => expect(onChanged.calls).to.have.length(1), {
        timeout: 2000,
      })
      expect(onChanged.calls).to.deep.include([55])
    },
  }),
  ...casesForTestObjects('Struct keys', {
    'bounceCar(...) returns a new object': (testObject) => {
      expect(Object.is(testObject.bounceCar(TEST_CAR), TEST_CAR)).to.equal(false)
    },

    'bounceCar(...) sets omitted optional keys to undefined': (testObject) => {
      expect(testObject.bounceCar(CAR_WITHOUT_DRIVER)).to.deep.equal({
        ...CAR_WITHOUT_DRIVER,
        driver: undefined,
        favouriteTrack: undefined,
        someVariant: undefined,
      })
    },

    'bounceCar(...) drops unknown keys': (testObject) => {
      const car = { ...TEST_CAR, color: 'red' }
      expect(testObject.bounceCar(car)).to.deep.equal(TEST_CAR)
    },

    'bounceCar(...) drops unknown keys of nested structs': (testObject) => {
      const driver = { ...TEST_PERSON, nickname: 'mrousavy' }
      const passenger = { name: 'Lukas', age: 18, seat: 'back' }
      const car = { ...TEST_CAR_2, driver, passengers: [passenger] }
      expect(testObject.bounceCar(car)).to.deep.equal({
        ...TEST_CAR_2,
        driver: TEST_PERSON,
        passengers: [{ name: 'Lukas', age: 18 }],
      })
    },

    'bouncePartialStruct(...) drops unknown keys': (testObject) => {
      const person = { name: 'Marc', age: 24, nickname: 'mrousavy' }
      expect(testObject.bouncePartialStruct(person)).to.deep.equal({
        name: 'Marc',
        age: 24,
      })
    },

    'getDriver(...) drops unknown keys of the driver': (testObject) => {
      const driver = { ...TEST_PERSON, nickname: 'mrousavy' }
      expect(testObject.getDriver({ ...TEST_CAR, driver })).to.deep.equal(TEST_PERSON)
    },

    'bounceOptionalWrapper(...) sets every key of {} to undefined': (testObject) => {
      expect(testObject.bounceOptionalWrapper({})).to.deep.equal({
        optionalArrayBuffer: undefined,
        optionalString: undefined,
      })
    },

    'bounceOptionalEnumStruct(...) sets every key of {} to undefined': (testObject) => {
      expect(testObject.bounceOptionalEnumStruct({})).to.deep.equal(EMPTY_OPTIONAL_ENUM_WRAPPER)
    },
  }),
  ...casesForTestObjects('Struct values', {
    'bounceCar(...) keeps isFast: false': (testObject) => {
      expect(Object.is(testObject.bounceCar({ ...TEST_CAR, isFast: false }).isFast, false)).to.equal(true)
    },

    'bounceCar(...) keeps an empty favouriteTrack': (testObject) => {
      expect(Object.is(testObject.bounceCar({ ...TEST_CAR, favouriteTrack: '' }).favouriteTrack, '')).to.equal(true)
    },

    'bounceCar(...) keeps a number someVariant': (testObject) => {
      expect(Object.is(testObject.bounceCar({ ...TEST_CAR, someVariant: 55 }).someVariant, 55)).to.equal(true)
    },

    'bounceCar(...) keeps a numeric string someVariant as a string': (testObject) => {
      expect(Object.is(testObject.bounceCar({ ...TEST_CAR, someVariant: '55' }).someVariant, '55')).to.equal(true)
    },

    'bounceOptionalEnumStruct(...) keeps falsy values': (testObject) => {
      expect(
        testObject.bounceOptionalEnumStruct({
          count: 0,
          ratio: 0,
          enabled: false,
          shouldRetry: false,
        })
      ).to.deep.equal({
        ...EMPTY_OPTIONAL_ENUM_WRAPPER,
        count: 0,
        ratio: 0,
        enabled: false,
        shouldRetry: false,
      })
    },

    'bounceWrappedJsStyleStruct(...) keeps every item': (testObject) => {
      const result = testObject.bounceWrappedJsStyleStruct({
        value: { value: 1, onChanged: () => {} },
        items: [
          { value: 2, onChanged: () => {} },
          { value: 3, onChanged: () => {} },
        ],
      })
      expect(result.items).to.have.length(2)
      for (const [index, item] of result.items.entries()) {
        expect(item.onChanged).to.be.a('function')
        expect(item).to.deep.equal({
          value: index + 2,
          onChanged: item.onChanged,
        })
      }
    },

    'isCarElectric(...) returns true for an electric car': (testObject) => {
      expect(
        Object.is(
          testObject.isCarElectric({
            ...CAR_WITHOUT_DRIVER,
            powertrain: 'electric',
          }),
          true
        )
      ).to.equal(true)
    },

    'areCarsEqual(...) returns true for equal copies': (testObject) => {
      const copy = {
        ...TEST_CAR_2,
        driver: { ...TEST_PERSON },
        passengers: TEST_CAR_2.passengers.map((p) => ({ ...p })),
      }
      expect(Object.is(testObject.areCarsEqual(TEST_CAR_2, copy), true)).to.equal(true)
    },

    'areCarsEqual(...) returns false when only a passenger differs': (testObject) => {
      const other = {
        ...TEST_CAR,
        passengers: [TEST_CAR.passengers[0]!, { name: 'Daniel', age: 28 }],
      }
      expect(Object.is(testObject.areCarsEqual(TEST_CAR, other), false)).to.equal(true)
    },

    'areCarsEqual(...) returns false when only the driver is missing': (testObject) => {
      const other = { ...TEST_CAR_2, driver: undefined }
      expect(Object.is(testObject.areCarsEqual(TEST_CAR_2, other), false)).to.equal(true)
    },

    'areCarsEqual(...) returns false for someVariant 1 vs "1"': (testObject) => {
      expect(Object.is(testObject.areCarsEqual({ ...TEST_CAR, someVariant: 1 }, { ...TEST_CAR, someVariant: '1' }), false)).to.equal(true)
    },

    'sumUpAllPassengers(...) returns an empty string for no cars': (testObject) => {
      expect(Object.is(testObject.sumUpAllPassengers([]), '')).to.equal(true)
    },

    'sumUpAllPassengers(...) returns an empty string without passengers': (testObject) => {
      expect(Object.is(testObject.sumUpAllPassengers([CAR_WITHOUT_DRIVER, CAR_WITHOUT_DRIVER]), '')).to.equal(true)
    },

    'sumUpAllPassengers(...) adds no separator for one passenger': (testObject) => {
      expect(
        Object.is(testObject.sumUpAllPassengers([{ ...CAR_WITHOUT_DRIVER, passengers: [{ name: 'Marc', age: 24 }] }]), 'Marc (24)')
      ).to.equal(true)
    },
  }),
  ...casesForTestObjects('Struct conversion errors', {
    'bounceCar(...) rejects a number': (testObject) => {
      // @ts-expect-error passing a number instead of a Car
      expect(() => testObject.bounceCar(5)).to.throw(`${testObject.constructor.name}.bounceCar(...): Value is a number, expected an Object`)
    },

    'bounceCar(...) rejects null': (testObject) => {
      // @ts-expect-error passing null instead of a Car
      expect(() => testObject.bounceCar(null)).to.throw(`${testObject.constructor.name}.bounceCar(...): Value is null, expected an Object`)
    },

    'bounceCar(...) rejects a missing string field': (testObject) => {
      const car = withoutKey(TEST_CAR, 'make')
      // @ts-expect-error passing a Car without a make
      expect(() => testObject.bounceCar(car)).to.throw(
        `${testObject.constructor.name}.bounceCar(...): Value is undefined, expected a String`
      )
    },

    'bounceCar(...) rejects a missing number field': (testObject) => {
      const car = withoutKey(TEST_CAR, 'year')
      // @ts-expect-error passing a Car without a year
      expect(() => testObject.bounceCar(car)).to.throw(
        `${testObject.constructor.name}.bounceCar(...): Value is undefined, expected a number`
      )
    },

    'bounceCar(...) rejects a missing array field': (testObject) => {
      const car = withoutKey(TEST_CAR, 'passengers')
      // @ts-expect-error passing a Car without passengers
      expect(() => testObject.bounceCar(car)).to.throw(
        `${testObject.constructor.name}.bounceCar(...): Value is undefined, expected an Object`
      )
    },

    'bounceCar(...) rejects a string number field': (testObject) => {
      expect(() =>
        // @ts-expect-error passing a string power
        testObject.bounceCar({ ...TEST_CAR, power: '640' })
      ).to.throw(`${testObject.constructor.name}.bounceCar(...): Value is a string, expected a number`)
    },

    'bounceCar(...) rejects a string optional boolean': (testObject) => {
      expect(() =>
        // @ts-expect-error passing a string isFast
        testObject.bounceCar({ ...TEST_CAR, isFast: 'yes' })
      ).to.throw(`${testObject.constructor.name}.bounceCar(...): Value is a string, expected a boolean`)
    },

    'bounceCar(...) rejects an unknown powertrain': (testObject) => {
      expect(() =>
        // @ts-expect-error passing an unknown Powertrain
        testObject.bounceCar({ ...TEST_CAR, powertrain: 'diesel' })
      ).to.throw(`${testObject.constructor.name}.bounceCar(...): Cannot convert "diesel" to enum Powertrain - invalid value!`)
    },

    'bounceCar(...) rejects a missing powertrain': (testObject) => {
      const car = withoutKey(TEST_CAR, 'powertrain')
      // @ts-expect-error passing a Car without its required enum field
      expect(() => testObject.bounceCar(car)).to.throw(
        `${testObject.constructor.name}.bounceCar(...): Value is undefined, expected a String`
      )
    },

    'bounceCar(...) rejects a null powertrain': (testObject) => {
      expect(() =>
        // @ts-expect-error passing null instead of a Powertrain
        testObject.bounceCar({ ...TEST_CAR, powertrain: null })
      ).to.throw(`${testObject.constructor.name}.bounceCar(...): Value is null, expected a String`)
    },

    'bounceCar(...) rejects a numeric powertrain': (testObject) => {
      expect(() =>
        // @ts-expect-error passing a number instead of a Powertrain
        testObject.bounceCar({ ...TEST_CAR, powertrain: 55 })
      ).to.throw(`${testObject.constructor.name}.bounceCar(...): Value is a number, expected a String`)
    },

    'bounceCar(...) rejects a null driver': (testObject) => {
      expect(() =>
        // @ts-expect-error passing null where only undefined is optional
        testObject.bounceCar({ ...TEST_CAR, driver: null })
      ).to.throw(`${testObject.constructor.name}.bounceCar(...): Value is null, expected an Object`)
    },

    'bounceCar(...) rejects a driver without an age': (testObject) => {
      const driver = withoutKey(TEST_PERSON, 'age')
      // @ts-expect-error passing a driver without an age
      expect(() => testObject.bounceCar({ ...TEST_CAR, driver })).to.throw(
        `${testObject.constructor.name}.bounceCar(...): Value is undefined, expected a number`
      )
    },

    'bounceCar(...) rejects a passenger with a number name': (testObject) => {
      const passengers = [{ name: 5, age: 18 }]
      // @ts-expect-error passing a number as the passenger name
      expect(() => testObject.bounceCar({ ...TEST_CAR, passengers })).to.throw(
        `${testObject.constructor.name}.bounceCar(...): Value is a number, expected a String`
      )
    },

    'bounceCar(...) rejects a string performance score': (testObject) => {
      const car = { ...TEST_CAR, performanceScores: [100, '0'] }
      // @ts-expect-error passing a string performance score
      expect(() => testObject.bounceCar(car)).to.throw(
        `${testObject.constructor.name}.bounceCar(...): Value is a string, expected a number`
      )
    },

    'bounceCar(...) rejects a boolean someVariant': (testObject) => {
      const car = { ...TEST_CAR, someVariant: true }
      // @ts-expect-error passing a boolean someVariant
      expect(() => testObject.bounceCar(car)).to.throw(
        `${testObject.constructor.name}.bounceCar(...): Cannot convert "true" to any type in variant<`
      )
    },

    'bouncePartialStruct(...) rejects a number name': (testObject) => {
      // @ts-expect-error passing a number name
      expect(() => testObject.bouncePartialStruct({ name: 5 })).to.throw(
        `${testObject.constructor.name}.bouncePartialStruct(...): Value is a number, expected a String`
      )
    },

    'bounceOptionalEnumStruct(...) rejects an unknown enum value': (testObject) => {
      const wrapper = { tier: 'diesel' }
      // @ts-expect-error passing an unknown Powertrain
      expect(() => testObject.bounceOptionalEnumStruct(wrapper)).to.throw(
        `${testObject.constructor.name}.bounceOptionalEnumStruct(...): Cannot convert "diesel" to enum Powertrain - invalid value!`
      )
    },

    'bounceOptionalEnumStruct(...) rejects a null enum field': (testObject) => {
      expect(() =>
        // @ts-expect-error optional enum fields accept undefined, not null
        testObject.bounceOptionalEnumStruct({ tier: null })
      ).to.throw(`${testObject.constructor.name}.bounceOptionalEnumStruct(...): Value is null, expected a String`)
    },

    'bounceOptionalEnumStruct(...) rejects a numeric enum field': (testObject) => {
      // @ts-expect-error passing a number instead of an optional Powertrain
      expect(() => testObject.bounceOptionalEnumStruct({ tier: 55 })).to.throw(
        `${testObject.constructor.name}.bounceOptionalEnumStruct(...): Value is a number, expected a String`
      )
    },

    'jsStyleObjectAsParameters(...) rejects a missing onChanged': (testObject) => {
      expect(() =>
        // @ts-expect-error passing a JsStyleStruct without onChanged
        testObject.jsStyleObjectAsParameters({ value: 55 })
      ).to.throw(`${testObject.constructor.name}.jsStyleObjectAsParameters(...): Value is undefined, expected an Object`)
    },
  }),
  ...casesForTestObjects('AnyJSON top-level values', {
    'mapRoundtrip(...) preserves every JSON kind, nesting and escapes': (testObject) => {
      for (const { label, value } of JSON_TEXT_CASES) {
        expect(testObject.mapRoundtrip(value), label).to.deep.equal(value)
      }
    },

    'copyAnyMap(...) preserves every JSON kind, nesting and escapes': (testObject) => {
      for (const { label, value } of JSON_TEXT_CASES) {
        expect(testObject.copyAnyMap(value), label).to.deep.equal(value)
      }
    },
  }),
  ...namedCases('C++ AnyJSON native text', {
    'createJSON(...) parses every JSON kind, nesting and escapes': () => {
      const testObject = new TestObjectCpp()
      for (const { label, json, value } of JSON_TEXT_CASES) {
        expect(testObject.createJSON(json), label).to.deep.equal(value)
      }
    },

    'createJSON(...) preserves negative zero from native text': () => {
      const testObject = new TestObjectCpp()
      expect(Object.is(testObject.createJSON('-0'), -0)).to.equal(true)
      // JSON.stringify normalizes -0 before mapRoundtrip receives it.
      expect(Object.is(testObject.mapRoundtrip(-0), 0)).to.equal(true)
    },

    'createJSONAsync(...) parses every JSON kind, nesting and escapes': async () => {
      const testObject = new TestObjectCpp()
      for (const { label, json, value } of JSON_TEXT_CASES) {
        const result = await withTimeout(testObject.createJSONAsync(json))
        expect(result, label).to.deep.equal(value)
      }
    },

    'createResolvedJSON(...) parses every JSON kind, nesting and escapes': async () => {
      const testObject = new TestObjectCpp()
      for (const { label, json, value } of JSON_TEXT_CASES) {
        const result = await withTimeout(testObject.createResolvedJSON(json))
        expect(result, label).to.deep.equal(value)
      }
    },

    'pending JSON promises parse every JSON kind, nesting and escapes': async () => {
      const testObject = new TestObjectCpp()
      for (const { label, json, value } of JSON_TEXT_CASES) {
        const promise = testObject.createPendingJSON()
        testObject.resolvePendingJSONOnWorker(json)
        expect(await withTimeout(promise), label).to.deep.equal(value)
      }
    },

    'createJSON(...) throws for malformed native JSON and remains usable': () => {
      const testObject = new TestObjectCpp()
      for (const json of INVALID_JSON) {
        expect(() => testObject.createJSON(json), json).to.throw(JSON_PARSE_ERROR)
        expect(testObject.createJSON('{"valid":true}')).to.deep.equal({
          valid: true,
        })
      }
    },

    'createResolvedJSON(...) rejects malformed native JSON and remains usable': async () => {
      const testObject = new TestObjectCpp()
      for (const json of INVALID_JSON) {
        const promise = testObject.createResolvedJSON(json)
        expect(promise).to.be.instanceOf(Promise)
        await expectJSONRejection(promise)
        expect(await withTimeout(testObject.createResolvedJSON('{"valid":true}'))).to.deep.equal({ valid: true })
      }
    },

    'createJSONAsync(...) rejects malformed native JSON and remains usable': async () => {
      const testObject = new TestObjectCpp()
      for (const json of INVALID_JSON) {
        const promise = testObject.createJSONAsync(json)
        expect(promise).to.be.instanceOf(Promise)
        await expectJSONRejection(promise)
        expect(await withTimeout(testObject.createJSONAsync('{"valid":true}'))).to.deep.equal({ valid: true })
      }
    },

    'pending JSON promises reject malformed native JSON and remain usable': async () => {
      const testObject = new TestObjectCpp()
      for (const json of INVALID_JSON) {
        const promise = testObject.createPendingJSON()
        expect(promise).to.be.instanceOf(Promise)
        testObject.resolvePendingJSONOnWorker(json)
        await expectJSONRejection(promise)
        const validPromise = testObject.createPendingJSON()
        testObject.resolvePendingJSONOnWorker('{"valid":true}')
        expect(await withTimeout(validPromise)).to.deep.equal({
          valid: true,
        })
      }
    },

    'getMapKeys(...) rejects nonobjects': () => {
      const testObject = new TestObjectCpp()
      const nonobjects: AnyJSON[] = [null, true, 42, 'text', []]
      for (const value of nonobjects) {
        expect(() => testObject.getMapKeys(value)).to.throw()
      }
      expect(testObject.getMapKeys({ valid: true })).to.deep.equal(['valid'])
    },

    'mergeMaps(...) rejects nonobjects in either argument': () => {
      const testObject = new TestObjectCpp()
      const nonobjects: AnyJSON[] = [null, false, 42, 'text', []]
      for (const value of nonobjects) {
        expect(() => testObject.mergeMaps(value, {})).to.throw()
        expect(() => testObject.mergeMaps({}, value)).to.throw()
      }
      expect(testObject.mergeMaps({ left: 1 }, { right: 2 })).to.deep.equal({
        left: 1,
        right: 2,
      })
    },

    'C++ object helpers reject lone surrogates accepted by JavaScript JSON': () => {
      const testObject = new TestObjectCpp()
      // nlohmann/json requires well-formed Unicode. JSON.stringify and
      // JSON.parse preserve these escapes, so core AnyJSON must preserve them too.
      const objects: AnyJSON[] = [{ value: '\uD800' }, { value: '\uDFFF' }, { '\uD800': { nested: '\uDFFF' } }]
      for (const object of objects) {
        expect(() => testObject.getMapKeys(object)).to.throw(/surrogate/i)
        expect(() => testObject.mergeMaps(object, {})).to.throw(/surrogate/i)
        expect(() => testObject.mergeMaps({}, object)).to.throw(/surrogate/i)
      }
      expect(testObject.getMapKeys({ valid: true })).to.deep.equal(['valid'])
      expect(testObject.mergeMaps({ left: 1 }, { right: 2 })).to.deep.equal({
        left: 1,
        right: 2,
      })
    },

    'mergeMaps(...) replaces collisions with null, arrays and nested objects': () => {
      const testObject = new TestObjectCpp()
      const left = {
        keep: true,
        nullable: 1,
        array: [1, 2],
        nested: { old: true },
      }
      const right = {
        nullable: null,
        array: [3],
        nested: { replacement: true },
      }
      expect(testObject.mergeMaps(left, right)).to.deep.equal({
        keep: true,
        nullable: null,
        array: [3],
        nested: { replacement: true },
      })
      expect(left).to.deep.equal({
        keep: true,
        nullable: 1,
        array: [1, 2],
        nested: { old: true },
      })
      expect(right).to.deep.equal({
        nullable: null,
        array: [3],
        nested: { replacement: true },
      })
    },
  }),
}
