import { expect } from 'chai'
import { casesForTestObjects, recordCallback, waitFor } from './utils/cases'
import { debugOnly, deferred } from './utils/helpers'
import {
  OldEnum,
  TestObjectCpp,
  TestObjectSwiftKotlin,
  type Car,
  type Powertrain,
  WeirdNumbersEnum,
  type WrappedJsStruct,
} from 'nitro-test'
import { NitroModules } from 'nitro-core'
import { TEST_CAR, TEST_CAR_2, TEST_PERSON } from './utils/fixtures'

const INT64_MAX = 9223372036854775807n

// 2^63 - 1
const INT64_MIN = -9223372036854775808n

// -(2^63)
const UINT64_MAX = 18446744073709551615n

// 2^64 - 1
const ONE_MIB = 1024 * 1024

const TRUCK_POWERTRAINS = ['electric', 'gas', 'hybrid', 'diesel'] as const

const BASE = new TestObjectSwiftKotlin().createBase()

const POWERTRAINS: Powertrain[] = ['electric', 'gas', 'hybrid']

const WEIRD_NUMBERS = [WeirdNumbersEnum.A, WeirdNumbersEnum.B, WeirdNumbersEnum.C]

// A Car without any of its optional keys (not even set to `undefined`)
const MINIMAL_CAR: Car = {
  year: 2020,
  make: 'Tesla',
  model: 'Model 3',
  power: 283,
  powertrain: 'electric',
  passengers: [],
  performanceScores: [],
}

// The original toEqual ignores undefined-valued keys. Preserve that behavior
// when comparing structs whose optional properties were omitted from the input.
function definedProperties(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, property]) => property !== undefined))
}

export const cases = {
  ...casesForTestObjects('Primitive properties', {
    'computedValue uses native getters and setters': (testObject) => {
      testObject.computedValue = 20
      expect(testObject.computedValue).to.equal(42)
    },

    'numberValue roundtrips': (testObject) => {
      testObject.numberValue = 13
      expect(Object.is(testObject.numberValue, 13)).to.equal(true)
      testObject.numberValue = 14
      expect(Object.is(testObject.numberValue, 14)).to.equal(true)
    },

    'boolValue roundtrips': (testObject) => {
      testObject.boolValue = false
      expect(Object.is(testObject.boolValue, false)).to.equal(true)
      testObject.boolValue = true
      expect(Object.is(testObject.boolValue, true)).to.equal(true)
    },

    'stringValue roundtrips': (testObject) => {
      testObject.stringValue = 'hello!'
      expect(Object.is(testObject.stringValue, 'hello!')).to.equal(true)
    },

    'int64Value roundtrips a positive BigInt': (testObject) => {
      testObject.int64Value = 7362572367826385n
      expect(Object.is(testObject.int64Value, 7362572367826385n)).to.equal(true)
    },

    'int64Value roundtrips a negative BigInt': (testObject) => {
      testObject.int64Value = -7362572367826385n
      expect(Object.is(testObject.int64Value, -7362572367826385n)).to.equal(true)
    },

    'uint64Value roundtrips a positive BigInt': (testObject) => {
      testObject.uint64Value = 7362572367826385n
      expect(Object.is(testObject.uint64Value, 7362572367826385n)).to.equal(true)
    },

    'uint64Value setter throws for a negative BigInt': (testObject) => {
      expect(() => {
        testObject.uint64Value = -7362572367826385n
      }).to.throw(`${testObject.constructor.name}.uint64Value: Lossy truncation in BigInt64::asUint64`)
    },
  }),
  ...casesForTestObjects('is*/has* accessor naming', {
    'hasBoolean is false': (testObject) => {
      expect(Object.is(testObject.hasBoolean, false)).to.equal(true)
    },

    'hasBooleanWritable roundtrips': (testObject) => {
      testObject.hasBooleanWritable = true
      expect(Object.is(testObject.hasBooleanWritable, true)).to.equal(true)
    },

    'isBoolean is false': (testObject) => {
      expect(Object.is(testObject.isBoolean, false)).to.equal(true)
    },

    'isBooleanWritable roundtrips': (testObject) => {
      testObject.isBooleanWritable = true
      expect(Object.is(testObject.isBooleanWritable, true)).to.equal(true)
    },

    'isolatedBoolean roundtrips': (testObject) => {
      testObject.isolatedBoolean = true
      expect(Object.is(testObject.isolatedBoolean, true)).to.equal(true)
    },

    'isTextValue roundtrips': (testObject) => {
      testObject.isTextValue = 'hello'
      expect(Object.is(testObject.isTextValue, 'hello')).to.equal(true)
    },
  }),
  ...casesForTestObjects('Basic functions', {
    'addNumbers(5, 13) returns 18': (testObject) => {
      expect(Object.is(testObject.addNumbers(5, 13), 18)).to.equal(true)
    },

    'addStrings("hello ", "world") returns "hello world"': (testObject) => {
      expect(Object.is(testObject.addStrings('hello ', 'world'), 'hello world')).to.equal(true)
    },

    'simpleFunc() returns undefined': (testObject) => {
      expect(testObject.simpleFunc()).to.equal(undefined)
    },

    'multipleArguments(...) returns undefined': (testObject) => {
      expect(testObject.multipleArguments(13, 'hello!', true)).to.equal(undefined)
    },

    'bounceNull(null) returns null': (testObject) => {
      expect(testObject.bounceNull(null)).to.equal(null)
    },

    'bounceNull(undefined) throws': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.bounceNull(undefined)).to.throw(`${testObject.constructor.name}.bounceNull(...)`)
    },
  }),
  ...casesForTestObjects('Number edge cases', {
    'numberValue roundtrips NaN': (testObject) => {
      testObject.numberValue = NaN
      expect(testObject.numberValue).to.be.NaN
    },

    'numberValue roundtrips Infinity': (testObject) => {
      testObject.numberValue = Infinity
      expect(Object.is(testObject.numberValue, Infinity)).to.equal(true)
    },

    'numberValue roundtrips -Infinity': (testObject) => {
      testObject.numberValue = -Infinity
      expect(Object.is(testObject.numberValue, -Infinity)).to.equal(true)
    },

    'numberValue keeps the sign of -0': (testObject) => {
      testObject.numberValue = -0
      expect(Object.is(testObject.numberValue, -0)).to.equal(true)
    },

    'numberValue roundtrips Number.MAX_VALUE': (testObject) => {
      testObject.numberValue = Number.MAX_VALUE
      expect(Object.is(testObject.numberValue, Number.MAX_VALUE)).to.equal(true)
    },

    'numberValue roundtrips the subnormal Number.MIN_VALUE': (testObject) => {
      testObject.numberValue = Number.MIN_VALUE
      expect(Object.is(testObject.numberValue, Number.MIN_VALUE)).to.equal(true)
    },

    'numberValue roundtrips Number.MAX_SAFE_INTEGER': (testObject) => {
      testObject.numberValue = Number.MAX_SAFE_INTEGER
      expect(Object.is(testObject.numberValue, Number.MAX_SAFE_INTEGER)).to.equal(true)
    },

    'numberValue roundtrips 2^64 without integer truncation': (testObject) => {
      testObject.numberValue = 2 ** 64
      expect(Object.is(testObject.numberValue, 2 ** 64)).to.equal(true)
    },

    'numberValue keeps full double precision': (testObject) => {
      testObject.numberValue = 1 / 3
      expect(Object.is(testObject.numberValue, 1 / 3)).to.equal(true)
    },

    'addNumbers(0.1, 0.2) matches JS double addition': (testObject) => {
      expect(Object.is(testObject.addNumbers(0.1, 0.2), 0.1 + 0.2)).to.equal(true)
    },

    'addNumbers(-0, -0) returns -0': (testObject) => {
      expect(Object.is(testObject.addNumbers(-0, -0), -0)).to.equal(true)
    },

    'addNumbers(Infinity, -Infinity) returns NaN': (testObject) => {
      expect(testObject.addNumbers(Infinity, -Infinity)).to.be.NaN
    },

    'addNumbers(NaN, 1) returns NaN': (testObject) => {
      expect(testObject.addNumbers(NaN, 1)).to.be.NaN
    },

    'addNumbers(MAX_VALUE, MAX_VALUE) overflows to Infinity': (testObject) => {
      expect(Object.is(testObject.addNumbers(Number.MAX_VALUE, Number.MAX_VALUE), Infinity)).to.equal(true)
    },

    'addNumbers(MIN_VALUE, MIN_VALUE) does not flush subnormals to 0': (testObject) => {
      expect(Object.is(testObject.addNumbers(Number.MIN_VALUE, Number.MIN_VALUE), Number.MIN_VALUE * 2)).to.equal(true)
    },

    'addNumbers(MAX_SAFE_INTEGER, 2) rounds to 2^53': (testObject) => {
      expect(Object.is(testObject.addNumbers(Number.MAX_SAFE_INTEGER, 2), 2 ** 53)).to.equal(true)
    },
  }),
  ...casesForTestObjects('String edge cases', {
    'stringValue roundtrips an empty string': (testObject) => {
      testObject.stringValue = 'hello!'
      testObject.stringValue = ''
      expect(Object.is(testObject.stringValue, '')).to.equal(true)
    },

    'stringValue roundtrips emoji (surrogate pairs and ZWJ sequences)': (testObject) => {
      testObject.stringValue = '👋🏽 🇦🇹 👨‍👩‍👧'
      expect(Object.is(testObject.stringValue, '👋🏽 🇦🇹 👨‍👩‍👧')).to.equal(true)
    },

    'stringValue roundtrips multi-byte UTF-8 text': (testObject) => {
      testObject.stringValue = 'Grüße, 日本語, עברית'
      expect(Object.is(testObject.stringValue, 'Grüße, 日本語, עברית')).to.equal(true)
    },

    'stringValue keeps combining characters unnormalized': (testObject) => {
      // "e" + COMBINING ACUTE ACCENT must not become the precomposed "\u00e9"
      testObject.stringValue = 'e\u0301'
      expect(Object.is(testObject.stringValue, 'e\u0301')).to.equal(true)
    },

    'stringValue roundtrips newlines and tabs': (testObject) => {
      testObject.stringValue = 'line 1\nline 2\r\n\tindented'
      expect(Object.is(testObject.stringValue, 'line 1\nline 2\r\n\tindented')).to.equal(true)
    },

    'stringValue roundtrips an embedded NUL character': (testObject) => {
      testObject.stringValue = 'before\0after'
      expect(Object.is(testObject.stringValue, 'before\0after')).to.equal(true)
    },

    'stringValue roundtrips a 1 MiB string': (testObject) => {
      const largeString = 'x'.repeat(ONE_MIB)
      testObject.stringValue = largeString
      const result = testObject.stringValue
      // Compare the length first so a mismatch doesn't print 2 MiB of text
      expect(Object.is(result.length, ONE_MIB)).to.equal(true)
      expect(Object.is(result, largeString)).to.equal(true)
    },

    'addStrings(...) concatenates emoji': (testObject) => {
      expect(Object.is(testObject.addStrings('👋🏽', '🇦🇹'), '👋🏽🇦🇹')).to.equal(true)
    },

    'addStrings("", "") returns an empty string': (testObject) => {
      expect(Object.is(testObject.addStrings('', ''), '')).to.equal(true)
    },

    'addStrings(...) keeps NUL characters': (testObject) => {
      expect(Object.is(testObject.addStrings('a\0', '\0b'), 'a\0\0b')).to.equal(true)
    },
  }),
  ...casesForTestObjects('BigInt boundaries', {
    'int64Value roundtrips INT64_MAX': (testObject) => {
      testObject.int64Value = INT64_MAX
      expect(Object.is(testObject.int64Value, INT64_MAX)).to.equal(true)
    },

    'int64Value roundtrips INT64_MIN': (testObject) => {
      testObject.int64Value = INT64_MIN
      expect(Object.is(testObject.int64Value, INT64_MIN)).to.equal(true)
    },

    'int64Value roundtrips 0n': (testObject) => {
      testObject.int64Value = 5n
      testObject.int64Value = 0n
      expect(Object.is(testObject.int64Value, 0n)).to.equal(true)
    },

    'int64Value setter throws for INT64_MAX + 1n': (testObject) => {
      expect(() => {
        testObject.int64Value = INT64_MAX + 1n
      }).to.throw(`${testObject.constructor.name}.int64Value: Lossy truncation in BigInt64::asInt64`)
    },

    'int64Value setter throws for INT64_MIN - 1n': (testObject) => {
      expect(() => {
        testObject.int64Value = INT64_MIN - 1n
      }).to.throw(`${testObject.constructor.name}.int64Value: Lossy truncation in BigInt64::asInt64`)
    },

    'int64Value keeps its value when the setter throws': (testObject) => {
      testObject.int64Value = 42n
      expect(() => {
        testObject.int64Value = INT64_MAX + 1n
      }).to.throw()
      expect(Object.is(testObject.int64Value, 42n)).to.equal(true)
    },

    'uint64Value roundtrips UINT64_MAX': (testObject) => {
      testObject.uint64Value = UINT64_MAX
      expect(Object.is(testObject.uint64Value, UINT64_MAX)).to.equal(true)
    },

    'uint64Value roundtrips values above INT64_MAX': (testObject) => {
      testObject.uint64Value = INT64_MAX + 1n
      expect(Object.is(testObject.uint64Value, INT64_MAX + 1n)).to.equal(true)
    },

    'uint64Value roundtrips 0n': (testObject) => {
      testObject.uint64Value = 5n
      testObject.uint64Value = 0n
      expect(Object.is(testObject.uint64Value, 0n)).to.equal(true)
    },

    'uint64Value setter throws for UINT64_MAX + 1n': (testObject) => {
      expect(() => {
        testObject.uint64Value = UINT64_MAX + 1n
      }).to.throw(`${testObject.constructor.name}.uint64Value: Lossy truncation in BigInt64::asUint64`)
    },
  }),
  ...casesForTestObjects('Argument type validation', {
    'addNumbers(...) throws for a numeric string': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers('1', 2)).to.throw(
        `${testObject.constructor.name}.addNumbers(...): Value is a string, expected a number`
      )
    },

    'addNumbers(...) throws for a BigInt': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers(1, 2n)).to.throw(
        `${testObject.constructor.name}.addNumbers(...): Value is a bigint, expected a number`
      )
    },

    'addNumbers(...) throws for an explicit undefined': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers(1, undefined)).to.throw(
        `${testObject.constructor.name}.addNumbers(...): Value is undefined, expected a number`
      )
    },

    'addStrings(...) throws for a number': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addStrings('a', 1)).to.throw(
        `${testObject.constructor.name}.addStrings(...): Value is a number, expected a String`
      )
    },

    'multipleArguments(...) throws for a number instead of a boolean': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.multipleArguments(13, 'hello!', 1)).to.throw(
        `${testObject.constructor.name}.multipleArguments(...): Value is a number, expected a boolean`
      )
    },

    'bounceNull(...) throws for a falsy non-null value': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.bounceNull(0)).to.throw(
        `${testObject.constructor.name}.bounceNull(...): Cannot convert non-null value to NullType!`
      )
    },

    'numberValue setter throws for a numeric string': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.numberValue = '13'
      }).to.throw(`${testObject.constructor.name}.numberValue: Value is a string, expected a number`)
    },

    'numberValue setter throws for a BigInt': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.numberValue = 13n
      }).to.throw(`${testObject.constructor.name}.numberValue: Value is a bigint, expected a number`)
    },

    'boolValue setter throws for a number instead of coercing it': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.boolValue = 1
      }).to.throw(`${testObject.constructor.name}.boolValue: Value is a number, expected a boolean`)
    },

    'stringValue setter throws for a number': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.stringValue = 13
      }).to.throw(`${testObject.constructor.name}.stringValue: Value is a number, expected a String`)
    },

    'int64Value setter throws for a number': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.int64Value = 13
      }).to.throw(`${testObject.constructor.name}.int64Value: Value is a number, expected a BigInt`)
    },

    'uint64Value setter throws for a number': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.uint64Value = 13
      }).to.throw(`${testObject.constructor.name}.uint64Value: Value is a number, expected a BigInt`)
    },
  }),
  ...casesForTestObjects('Argument count validation', {
    'addNumbers(...) throws for one argument': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers(1)).to.throw(
        `\`${testObject.constructor.name}.addNumbers(...)\` expected 2 arguments, but received 1!`
      )
    },

    'addNumbers(...) throws for three arguments': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers(1, 2, 3)).to.throw(
        `\`${testObject.constructor.name}.addNumbers(...)\` expected 2 arguments, but received 3!`
      )
    },

    'addNumbers() throws for no arguments': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers()).to.throw(
        `\`${testObject.constructor.name}.addNumbers(...)\` expected 2 arguments, but received 0!`
      )
    },

    'addNumbers(...) checks the argument count before the types': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers('a')).to.throw(
        `\`${testObject.constructor.name}.addNumbers(...)\` expected 2 arguments, but received 1!`
      )
    },

    'simpleFunc(...) throws for an unexpected argument': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.simpleFunc(1)).to.throw(
        `\`${testObject.constructor.name}.simpleFunc(...)\` expected 0 arguments, but received 1!`
      )
    },

    'multipleArguments(...) throws for a missing argument': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.multipleArguments(13, 'hello!')).to.throw(
        `\`${testObject.constructor.name}.multipleArguments(...)\` expected 3 arguments, but received 2!`
      )
    },
  }),
  ...casesForTestObjects('Nullability & optional properties', {
    'stringOrUndefined roundtrips a string and undefined': (testObject) => {
      testObject.stringOrUndefined = 'hello'
      expect(Object.is(testObject.stringOrUndefined, 'hello')).to.equal(true)
      testObject.stringOrUndefined = undefined
      expect(testObject.stringOrUndefined).to.equal(undefined)
    },

    'stringOrUndefined setter throws for null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.stringOrUndefined = null
      }).to.throw(`${testObject.constructor.name}.stringOrUndefined`)
    },

    'optionalString roundtrips a string and undefined': (testObject) => {
      testObject.optionalString = 'hello'
      expect(Object.is(testObject.optionalString, 'hello')).to.equal(true)
      testObject.optionalString = undefined
      expect(testObject.optionalString).to.equal(undefined)
    },

    'nullValue roundtrips null': (testObject) => {
      expect(testObject.nullValue).to.equal(null)
      testObject.nullValue = null
      expect(testObject.nullValue).to.equal(null)
    },

    'nullValue setter throws for undefined': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.nullValue = undefined
      }).to.throw(`${testObject.constructor.name}.nullValue`)
    },

    'nullValue setter throws for a number': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.nullValue = 19
      }).to.throw(`${testObject.constructor.name}.nullValue`)
    },

    'stringOrNull roundtrips a string and null': (testObject) => {
      testObject.stringOrNull = 'hello'
      expect(Object.is(testObject.stringOrNull, 'hello')).to.equal(true)
      testObject.stringOrNull = null
      expect(testObject.stringOrNull).to.equal(null)
    },

    'optionalArray roundtrips undefined': (testObject) => {
      testObject.optionalArray = undefined
      expect(testObject.optionalArray).to.equal(undefined)
    },

    'optionalArray roundtrips an array': (testObject) => {
      testObject.optionalArray = ['hello', 'world']
      expect(testObject.optionalArray).to.deep.equal(['hello', 'world'])
    },

    'optionalHybrid roundtrips undefined': (testObject) => {
      testObject.optionalHybrid = undefined
      expect(testObject.optionalHybrid).to.equal(undefined)
    },

    'optionalHybrid roundtrips the same HybridObject': (testObject) => {
      try {
        testObject.optionalHybrid = testObject
        expect(Object.is(testObject.optionalHybrid, testObject)).to.equal(true)
      } finally {
        // Break the reference cycle (testObject holding itself)
        testObject.optionalHybrid = undefined
      }
    },

    'optionalEnum roundtrips undefined': (testObject) => {
      testObject.optionalEnum = undefined
      expect(testObject.optionalEnum).to.equal(undefined)
    },

    'optionalEnum roundtrips a value': (testObject) => {
      testObject.optionalEnum = 'gas'
      expect(Object.is(testObject.optionalEnum, 'gas')).to.equal(true)
    },

    'optionalOldEnum roundtrips undefined': (testObject) => {
      testObject.optionalOldEnum = undefined
      expect(testObject.optionalOldEnum).to.equal(undefined)
    },

    'optionalOldEnum roundtrips a value': (testObject) => {
      testObject.optionalOldEnum = OldEnum.SECOND
      expect(Object.is(testObject.optionalOldEnum, OldEnum.SECOND)).to.equal(true)
    },

    'optionalOldEnum rejects an unknown integer': (testObject) => {
      expect(() => {
        // @ts-expect-error passing an unknown OldEnum value
        testObject.optionalOldEnum = 9999
      }).to.throw(`${testObject.constructor.name}.optionalOldEnum: Cannot convert 9999 to enum OldEnum - invalid value!`)
    },

    'optionalOldEnum rejects fractional and out-of-range numbers': (testObject) => {
      for (const value of [1.5, 2147483648]) {
        expect(() => {
          testObject.optionalOldEnum = value
        }).to.throw(
          `${testObject.constructor.name}.optionalOldEnum: Cannot convert ${value.toFixed(6)} to int - expected an integer within the int range!`
        )
      }
    },

    'optionalOldEnum rejects a string': (testObject) => {
      expect(() => {
        // @ts-expect-error passing a string instead of a numeric enum
        testObject.optionalOldEnum = '1'
      }).to.throw(`${testObject.constructor.name}.optionalOldEnum: Value is a string, expected a number`)
    },

    'optionalCallback roundtrips a function and undefined': (testObject) => {
      testObject.optionalCallback = () => {}
      expect(testObject.optionalCallback).to.be.a('function')
      testObject.optionalCallback = undefined
      expect(testObject.optionalCallback).to.equal(undefined)
    },
  }),
  ...casesForTestObjects('Optional parameters & argument-count validation', {
    'tryOptionalParams(...) with the optional param omitted': (testObject) => {
      expect(Object.is(testObject.tryOptionalParams(13, true), 'value omitted!')).to.equal(true)
    },

    'tryOptionalParams(...) with the optional param provided': (testObject) => {
      expect(Object.is(testObject.tryOptionalParams(13, true, 'hello'), 'hello')).to.equal(true)
    },

    'tryOptionalParams(...) throws for one argument too many': (testObject) => {
      expect(() =>
        testObject.tryOptionalParams(
          13,
          true,
          'hello',
          // @ts-expect-error
          'too many args!'
        )
      ).to.throw(`\`${testObject.constructor.name}.tryOptionalParams(...)\` expected between 2 and 3 arguments, but received 4!`)
    },

    'tryOptionalParams(...) throws for one argument too few': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalParams(13)).to.throw(
        `\`${testObject.constructor.name}.tryOptionalParams(...)\` expected between 2 and 3 arguments, but received 1!`
      )
    },

    'tryMiddleParam(...) with undefined in the middle': (testObject) => {
      expect(Object.is(testObject.tryMiddleParam(13, undefined, 'hello!'), 'hello!')).to.equal(true)
    },

    'tryMiddleParam(...) with true in the middle': (testObject) => {
      expect(Object.is(testObject.tryMiddleParam(13, true, 'passed'), 'passed')).to.equal(true)
    },

    'tryOptionalEnum(...) with a value': (testObject) => {
      expect(Object.is(testObject.tryOptionalEnum('gas'), 'gas')).to.equal(true)
    },

    'tryOptionalEnum(...) with undefined': (testObject) => {
      expect(testObject.tryOptionalEnum(undefined)).to.equal(undefined)
    },

    'tryTrailingOptional(...) with false': (testObject) => {
      expect(Object.is(testObject.tryTrailingOptional(0, '', false), false)).to.equal(true)
    },

    'tryTrailingOptional(...) with true': (testObject) => {
      expect(Object.is(testObject.tryTrailingOptional(0, '', true), true)).to.equal(true)
    },

    'tryOptionalParams(...) treats an explicit undefined as omitted': (testObject) => {
      expect(Object.is(testObject.tryOptionalParams(13, true, undefined), 'value omitted!')).to.equal(true)
    },

    'tryOptionalParams(...) keeps an empty string': (testObject) => {
      expect(Object.is(testObject.tryOptionalParams(13, true, ''), '')).to.equal(true)
    },

    'tryOptionalParams(...) throws for null as the optional param': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalParams(13, true, null)).to.throw(
        `${testObject.constructor.name}.tryOptionalParams(...): Value is null, expected a String`
      )
    },

    'tryMiddleParam(...) throws when the last param is omitted': (testObject) => {
      // A middle optional param does not make the params after it optional
      // @ts-expect-error
      expect(() => testObject.tryMiddleParam(13, undefined)).to.throw(
        `\`${testObject.constructor.name}.tryMiddleParam(...)\` expected 3 arguments, but received 2!`
      )
    },

    'tryOptionalEnum() with no arguments returns undefined': (testObject) => {
      expect(testObject.tryOptionalEnum()).to.equal(undefined)
    },

    'tryOptionalEnum(...) throws for an invalid enum value': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalEnum('diesel')).to.throw(
        `${testObject.constructor.name}.tryOptionalEnum(...): Cannot convert "diesel" to enum Powertrain - invalid value!`
      )
    },

    'tryOptionalEnum(...) throws for two arguments': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalEnum('gas', 'gas')).to.throw(
        `\`${testObject.constructor.name}.tryOptionalEnum(...)\` expected between 0 and 1 arguments, but received 2!`
      )
    },

    'tryTrailingOptional(...) returns false with the optional param omitted': (testObject) => {
      expect(Object.is(testObject.tryTrailingOptional(0, ''), false)).to.equal(true)
    },

    'tryTrailingOptional(...) throws for one argument': (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryTrailingOptional(0)).to.throw(
        `\`${testObject.constructor.name}.tryTrailingOptional(...)\` expected between 2 and 3 arguments, but received 1!`
      )
    },
  }),
  ...casesForTestObjects('optionalEnumPlusOne', {
    "optionalEnumPlusOne roundtrips 'electric'": (testObject) => {
      const value = TRUCK_POWERTRAINS[0]!

      testObject.optionalEnumPlusOne = value
      expect(Object.is(testObject.optionalEnumPlusOne, value)).to.equal(true)
    },

    "optionalEnumPlusOne roundtrips 'gas'": (testObject) => {
      const value = TRUCK_POWERTRAINS[1]!

      testObject.optionalEnumPlusOne = value
      expect(Object.is(testObject.optionalEnumPlusOne, value)).to.equal(true)
    },

    "optionalEnumPlusOne roundtrips 'hybrid'": (testObject) => {
      const value = TRUCK_POWERTRAINS[2]!

      testObject.optionalEnumPlusOne = value
      expect(Object.is(testObject.optionalEnumPlusOne, value)).to.equal(true)
    },

    "optionalEnumPlusOne roundtrips 'diesel'": (testObject) => {
      const value = TRUCK_POWERTRAINS[3]!

      testObject.optionalEnumPlusOne = value
      expect(Object.is(testObject.optionalEnumPlusOne, value)).to.equal(true)
    },

    'optionalEnumPlusOne roundtrips undefined': (testObject) => {
      testObject.optionalEnumPlusOne = 'diesel'
      testObject.optionalEnumPlusOne = undefined
      expect(testObject.optionalEnumPlusOne).to.equal(undefined)
    },

    'optionalEnumPlusOne setter throws for a value outside the union': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnumPlusOne = 'petrol'
      }).to.throw(`${testObject.constructor.name}.optionalEnumPlusOne: Cannot convert "petrol" to enum TruckPowertrain - invalid value!`)
    },

    'optionalEnumPlusOne setter is case-sensitive': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnumPlusOne = 'Diesel'
      }).to.throw(`${testObject.constructor.name}.optionalEnumPlusOne: Cannot convert "Diesel" to enum TruckPowertrain - invalid value!`)
    },

    'optionalEnum setter throws for the TruckPowertrain-only value': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnum = 'diesel'
      }).to.throw(`${testObject.constructor.name}.optionalEnum: Cannot convert "diesel" to enum Powertrain - invalid value!`)
    },
  }),
  ...casesForTestObjects('Optional properties reject null', {
    'optionalString setter throws for null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalString = null
      }).to.throw(`${testObject.constructor.name}.optionalString: Value is null, expected a String`)
    },

    'optionalString keeps its value when the setter throws': (testObject) => {
      testObject.optionalString = 'hello'
      expect(() => {
        // @ts-expect-error
        testObject.optionalString = null
      }).to.throw()
      expect(Object.is(testObject.optionalString, 'hello')).to.equal(true)
    },

    'optionalArray setter throws for null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalArray = null
      }).to.throw(`${testObject.constructor.name}.optionalArray: Value is null, expected an Object`)
    },

    'optionalEnum setter throws for null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnum = null
      }).to.throw(`${testObject.constructor.name}.optionalEnum: Value is null, expected a String`)
    },

    'optionalEnumPlusOne setter throws for null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnumPlusOne = null
      }).to.throw(`${testObject.constructor.name}.optionalEnumPlusOne: Value is null, expected a String`)
    },

    'optionalOldEnum setter throws for null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalOldEnum = null
      }).to.throw(`${testObject.constructor.name}.optionalOldEnum: Value is null, expected a number`)
    },

    'optionalCallback setter throws for null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalCallback = null
      }).to.throw(`${testObject.constructor.name}.optionalCallback: Value is null, expected an Object`)
    },

    'optionalHybrid setter throws for null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalHybrid = null
      }).to.throw(`${testObject.constructor.name}.optionalHybrid: ${debugOnly('Cannot convert "null" to NativeState<')}`)
    },

    'stringOrNull setter throws for undefined': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.stringOrNull = undefined
      }).to.throw(`${testObject.constructor.name}.stringOrNull: Cannot convert "undefined" to any type in variant<`)
    },
  }),
  ...casesForTestObjects('Optional properties keep falsy values', {
    'optionalString keeps an empty string': (testObject) => {
      testObject.optionalString = ''
      expect(Object.is(testObject.optionalString, '')).to.equal(true)
    },

    'stringOrUndefined keeps an empty string': (testObject) => {
      testObject.stringOrUndefined = ''
      expect(Object.is(testObject.stringOrUndefined, '')).to.equal(true)
    },

    'stringOrNull keeps an empty string': (testObject) => {
      testObject.stringOrNull = ''
      expect(Object.is(testObject.stringOrNull, '')).to.equal(true)
    },

    'optionalArray keeps an empty array': (testObject) => {
      testObject.optionalArray = []
      expect(testObject.optionalArray).to.deep.equal([])
    },

    'optionalOldEnum keeps OldEnum.FIRST (0)': (testObject) => {
      testObject.optionalOldEnum = OldEnum.FIRST
      expect(Object.is(testObject.optionalOldEnum, OldEnum.FIRST)).to.equal(true)
    },
  }),
  ...casesForTestObjects('optionalCallback getter', {
    'optionalCallback getter returns a function that calls the JS callback': async (testObject) => {
      const callback = recordCallback<(value: number) => void>()
      try {
        testObject.optionalCallback = callback
        const forward = testObject.optionalCallback
        expect(forward).to.be.a('function')
        forward?.(55)
        await waitFor(() => expect(callback.calls).to.deep.include([55]), {
          timeout: 2000,
        })
      } finally {
        testObject.optionalCallback = undefined
      }
    },

    'optionalCallback getter preserves the original JS function': (testObject) => {
      const callback = recordCallback<(value: number) => void>()
      try {
        testObject.optionalCallback = callback
        const forward = testObject.optionalCallback
        expect(forward).to.equal(callback)
        // Returning a JS callback preserves its identity and JS call semantics.
        // @ts-expect-error intentionally omit the callback argument
        forward?.()
        // @ts-expect-error intentionally pass an extra callback argument
        forward?.(55, 89)
        expect(callback.calls).to.deep.equal([[], [55, 89]])
      } finally {
        testObject.optionalCallback = undefined
      }
    },
  }),
  ...casesForTestObjects('Variants', {
    'someVariant roundtrips a number': (testObject) => {
      testObject.someVariant = 55
      expect(Object.is(testObject.someVariant, 55)).to.equal(true)
    },

    'someVariant roundtrips a string': (testObject) => {
      testObject.someVariant = 'some-string'
      expect(Object.is(testObject.someVariant, 'some-string')).to.equal(true)
    },

    'someVariant throws when set to a boolean': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.someVariant = false
      }).to.throw(
        `${testObject.constructor.name}.someVariant: Cannot convert "false" to any type in ${debugOnly('variant<double, std::string>!')}`
      )
    },

    'passVariant(...) returns a fallback for an array': (testObject) => {
      expect(Object.is(testObject.passVariant([1, 2, 3]), 'holds something else!')).to.equal(true)
    },

    'passVariant(...) bounces a string': (testObject) => {
      expect(Object.is(testObject.passVariant('hello!'), 'hello!')).to.equal(true)
    },

    'passVariant(...) bounces a number': (testObject) => {
      expect(Object.is(testObject.passVariant(5), 5)).to.equal(true)
    },

    'passVariant(...) throws for an object': (testObject) => {
      expect(() =>
        testObject.passVariant(
          // @ts-expect-error
          {}
        )
      ).to.throw(`${testObject.constructor.name}.passVariant(...): Cannot convert "[object Object]" to any type in `)
    },

    'passAllEmptyObjectVariant(...) bounces an empty object': (testObject) => {
      // `toEqual({})` would also match a (release) HybridObject, so check that
      // it came back as an OptionalWrapper struct with every key.
      expect(testObject.passAllEmptyObjectVariant({})).to.deep.equal({
        optionalArrayBuffer: undefined,
        optionalString: undefined,
      })
    },

    'passAllEmptyObjectVariant(...) bounces an OptionalWrapper': (testObject) => {
      expect(
        definedProperties(
          testObject.passAllEmptyObjectVariant({
            optionalString: 'optional string!',
          })
        )
      ).to.deep.equal({ optionalString: 'optional string!' })
    },

    'passAllEmptyObjectVariant(...) bounces a Base': (testObject) => {
      expect(Object.is(testObject.passAllEmptyObjectVariant(BASE), BASE)).to.equal(true)
    },

    'bounceComplexVariant(...) bounces an ArrayBuffer': (testObject) => {
      const buffer = testObject.createArrayBuffer()
      // The buffer is 10 MB of uninitialized memory, so don't compare (or
      // print) all of its bytes - only a few marked ones.
      const bytes = new Uint8Array(buffer)
      bytes.set([13, 37])
      bytes[bytes.length - 1] = 42
      const result = testObject.bounceComplexVariant(buffer)
      expect(result).to.be.instanceOf(ArrayBuffer)
      const resultBytes = new Uint8Array(result as ArrayBuffer)
      expect(Object.is(resultBytes.byteLength, buffer.byteLength)).to.equal(true)
      expect([resultBytes[0], resultBytes[1], resultBytes[resultBytes.length - 1]]).to.deep.equal([13, 37, 42])
    },

    'bounceComplexVariant(...) bounces a Promise': async (testObject) => {
      const { promise, resolve } = deferred<number>()
      const result = testObject.bounceComplexVariant(promise)
      expect(result).to.be.instanceOf(Promise)
      resolve(55)
      await expect(Object.is(await result, 55)).to.equal(true)
    },

    'bounceComplexVariant(...) bounces a callback': async (testObject) => {
      const callback = recordCallback<(value: number) => void>()
      const result = testObject.bounceComplexVariant(callback)
      expect(result).to.be.a('function')
      const bounced = result as (value: number) => void
      bounced(5)
      await waitFor(() => expect(callback.calls).to.deep.include([5]), {
        timeout: 2000,
      })
    },

    'bounceComplexVariant(...) bounces a struct': (testObject) => {
      const result = testObject.bounceComplexVariant({
        items: [],
        value: { onChanged: () => {}, value: 55 },
      }) as WrappedJsStruct
      expect(result.value.onChanged).to.be.a('function')
      expect(result).to.deep.equal({
        items: [],
        value: { onChanged: result.value.onChanged, value: 55 },
      })
    },

    'bounceComplexVariant(...) bounces an AnyJSON': (testObject) => {
      expect(testObject.bounceComplexVariant({ whateverValue: 55 })).to.deep.equal({
        whateverValue: 55,
      })
    },

    'createChild().bounceVariant(...) bounces a string': (testObject) => {
      expect(Object.is(testObject.createChild().bounceVariant('hello!'), 'hello!')).to.equal(true)
    },

    'getVariantEnum(...) bounces an enum': (testObject) => {
      expect(Object.is(testObject.getVariantEnum(OldEnum.THIRD), OldEnum.THIRD)).to.equal(true)
    },

    'getVariantEnum(...) bounces a boolean': (testObject) => {
      expect(Object.is(testObject.getVariantEnum(true), true)).to.equal(true)
    },

    'getVariantEnum(...) throws for a string': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum('string')
      ).to.throw(
        `${testObject.constructor.name}.getVariantEnum(...): Cannot convert "string" to any type in ${debugOnly('variant<margelo::nitro::test::OldEnum, bool>!')}`
      )
    },

    'getVariantEnum(...) throws for an out-of-range number': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum(9999)
      ).to.throw(
        `${testObject.constructor.name}.getVariantEnum(...): Cannot convert "9999" to any type in ${debugOnly('variant<margelo::nitro::test::OldEnum, bool>!')}`
      )
    },

    'bounceVariantUnionEnum(...) bounces a Car': (testObject) => {
      expect(testObject.bounceVariantUnionEnum(TEST_CAR)).to.deep.equal(TEST_CAR)
    },

    'bounceVariantUnionEnum(...) throws for an unknown string': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceVariantUnionEnum('diesel')
      ).to.throw(`${testObject.constructor.name}.bounceVariantUnionEnum(...): Cannot convert "diesel" to any type in `)
    },

    'bounceVariantUnionEnum(...) throws for a wrong object': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceVariantUnionEnum({})
      ).to.throw(`${testObject.constructor.name}.bounceVariantUnionEnum(...): Cannot convert "[object Object]" to any type in `)
    },

    'bounceVariantUnionEnum(...) throws for a boolean': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceVariantUnionEnum(true)
      ).to.throw(`${testObject.constructor.name}.bounceVariantUnionEnum(...): Cannot convert "true" to any type in `)
    },

    'getVariantWeirdNumbersEnum(...) bounces a boolean': (testObject) => {
      expect(Object.is(testObject.getVariantWeirdNumbersEnum(true), true)).to.equal(true)
    },

    'getVariantWeirdNumbersEnum(...) throws for a string': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantWeirdNumbersEnum('string')
      ).to.throw(
        `${testObject.constructor.name}.getVariantWeirdNumbersEnum(...): Cannot convert "string" to any type in ${debugOnly('variant<margelo::nitro::test::WeirdNumbersEnum, bool>!')}`
      )
    },

    'getVariantWeirdNumbersEnum(...) throws for an out-of-range number': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantWeirdNumbersEnum(99999)
      ).to.throw(
        `${testObject.constructor.name}.getVariantWeirdNumbersEnum(...): Cannot convert "99999" to any type in ${debugOnly('variant<margelo::nitro::test::WeirdNumbersEnum, bool>!')}`
      )
    },

    'getVariantObjects(...) bounces a Person': (testObject) => {
      expect(testObject.getVariantObjects(TEST_PERSON)).to.deep.equal(TEST_PERSON)
    },

    'getVariantObjects(...) bounces a Car': (testObject) => {
      expect(testObject.getVariantObjects(TEST_CAR)).to.deep.equal(TEST_CAR)
    },

    'getVariantObjects(...) bounces a Car with a driver': (testObject) => {
      const car = { ...TEST_CAR, driver: TEST_PERSON }
      expect(testObject.getVariantObjects(car)).to.deep.equal(car)
    },

    'getVariantObjects(...) throws for a string': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects('some-string')
      ).to.throw(
        `${testObject.constructor.name}.getVariantObjects(...): Cannot convert "some-string" to any type in ${debugOnly(`variant<margelo::nitro::test::Person, margelo::nitro::test::Car>!`)}`
      )
    },

    'getVariantObjects(...) throws for a wrong object': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects({ someValue: 55 })
      ).to.throw(
        `${testObject.constructor.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in ${debugOnly(`variant<margelo::nitro::test::Person, margelo::nitro::test::Car>!`)}`
      )
    },

    'getVariantHybrid(...) bounces a HybridObject': (testObject) => {
      // @ts-expect-error `testObject` is a union of both TestObject types
      const result = testObject.getVariantHybrid(testObject)
      expect(Object.is(result, testObject)).to.equal(true)
    },

    'getVariantHybrid(...) bounces a Person': (testObject) => {
      expect(testObject.getVariantHybrid(TEST_PERSON)).to.deep.equal(TEST_PERSON)
    },

    'getVariantHybrid(...) throws for a string': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybrid('some-string')
      ).to.throw(`${testObject.constructor.name}.getVariantHybrid(...): Cannot convert "some-string" to any type in `)
    },

    'getVariantHybrid(...) throws for a wrong object': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybrid({ someValue: 55 })
      ).to.throw(`${testObject.constructor.name}.getVariantHybrid(...): Cannot convert "[object Object]" to any type in `)
    },

    'passNamedVariant(...) bounces a string': (testObject) => {
      expect(Object.is(testObject.passNamedVariant('Hello world!'), 'Hello world!')).to.equal(true)
    },
  }),
  ...casesForTestObjects('Variant edge cases', {
    'someVariant switches from a string back to a number': (testObject) => {
      testObject.someVariant = 'some-string'
      testObject.someVariant = 55
      expect(Object.is(testObject.someVariant, 55)).to.equal(true)
    },

    'someVariant keeps a numeric string a string': (testObject) => {
      testObject.someVariant = '55'
      expect(Object.is(testObject.someVariant, '55')).to.equal(true)
    },

    'someVariant roundtrips -0': (testObject) => {
      testObject.someVariant = -0
      expect(Object.is(testObject.someVariant, -0)).to.equal(true)
    },

    'someVariant throws when set to null': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.someVariant = null
      }).to.throw(
        `${testObject.constructor.name}.someVariant: Cannot convert "null" to any type in ${debugOnly('variant<double, std::string>!')}`
      )
    },

    'someVariant throws when set to undefined': (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.someVariant = undefined
      }).to.throw(
        `${testObject.constructor.name}.someVariant: Cannot convert "undefined" to any type in ${debugOnly('variant<double, std::string>!')}`
      )
    },

    'someVariant keeps its value after a failed set': (testObject) => {
      testObject.someVariant = 'before'
      expect(() => {
        // @ts-expect-error
        testObject.someVariant = false
      }).to.throw(`${testObject.constructor.name}.someVariant: Cannot convert "false"`)
      expect(Object.is(testObject.someVariant, 'before')).to.equal(true)
    },

    'passVariant(...) bounces 0 as a number': (testObject) => {
      expect(Object.is(testObject.passVariant(0), 0)).to.equal(true)
    },

    'passVariant(...) bounces NaN': (testObject) => {
      expect(testObject.passVariant(NaN)).to.be.NaN
    },

    'passVariant(...) bounces an empty string': (testObject) => {
      expect(Object.is(testObject.passVariant(''), '')).to.equal(true)
    },

    'passVariant(...) keeps a numeric string a string': (testObject) => {
      expect(Object.is(testObject.passVariant('5'), '5')).to.equal(true)
    },

    'passVariant(...) returns a fallback for false': (testObject) => {
      expect(Object.is(testObject.passVariant(false), 'holds something else!')).to.equal(true)
    },

    'passVariant(...) returns a fallback for an empty array': (testObject) => {
      expect(Object.is(testObject.passVariant([]), 'holds something else!')).to.equal(true)
    },

    'passVariant(...) returns a fallback for a string array': (testObject) => {
      expect(Object.is(testObject.passVariant(['a', 'b']), 'holds something else!')).to.equal(true)
    },

    'passVariant(...) throws for null with every accepted type': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.passVariant(null)
      ).to.throw(
        `${testObject.constructor.name}.passVariant(...): Cannot convert "null" to any type in ${debugOnly('variant<bool, std::vector<double>, std::vector<std::string>, double, std::string>!')}`
      )
    },

    'passVariant(...) throws for a bigint': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.passVariant(5n)
      ).to.throw(`${testObject.constructor.name}.passVariant(...): Cannot convert "5" to any type in `)
    },

    'passVariant(...) throws for nested arrays': (testObject) => {
      expect(() =>
        testObject.passVariant(
          // @ts-expect-error
          [[1, 2], [3]]
        )
      ).to.throw(`${testObject.constructor.name}.passVariant(...): Cannot convert "1,2,3" to any type in `)
    },

    'passVariant(...) throws for a mixed number/string array': (testObject) => {
      expect(() =>
        testObject.passVariant(
          // @ts-expect-error
          [1, 'two']
        )
      ).to.throw(`${testObject.constructor.name}.passVariant(...): `)
    },

    'getVariantEnum(...) bounces OldEnum.FIRST (0)': (testObject) => {
      expect(Object.is(testObject.getVariantEnum(OldEnum.FIRST), OldEnum.FIRST)).to.equal(true)
    },

    'getVariantEnum(...) bounces false': (testObject) => {
      expect(Object.is(testObject.getVariantEnum(false), false)).to.equal(true)
    },

    'getVariantEnum(...) throws one past the last enum value': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum(3)
      ).to.throw(`${testObject.constructor.name}.getVariantEnum(...): Cannot convert "3" to any type in `)
    },

    'getVariantEnum(...) throws for a negative number': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum(-1)
      ).to.throw(`${testObject.constructor.name}.getVariantEnum(...): Cannot convert "-1" to any type in `)
    },

    'getVariantEnum(...) throws for a fractional number': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum(1.5)
      ).to.throw(`${testObject.constructor.name}.getVariantEnum(...): Cannot convert "1.5" to any type in `)
    },

    'getVariantWeirdNumbersEnum(...) bounces every enum value': (testObject) => {
      for (const value of WEIRD_NUMBERS) {
        expect(Object.is(testObject.getVariantWeirdNumbersEnum(value), value), `${value}`).to.equal(true)
      }
    },

    'getVariantWeirdNumbersEnum(...) bounces false': (testObject) => {
      expect(Object.is(testObject.getVariantWeirdNumbersEnum(false), false)).to.equal(true)
    },

    'getVariantWeirdNumbersEnum(...) throws between two enum values': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantWeirdNumbersEnum(33)
      ).to.throw(`${testObject.constructor.name}.getVariantWeirdNumbersEnum(...): Cannot convert "33" to any type in `)
    },

    'bounceVariantUnionEnum(...) bounces every Powertrain': (testObject) => {
      for (const powertrain of POWERTRAINS) {
        expect(Object.is(testObject.bounceVariantUnionEnum(powertrain), powertrain), powertrain).to.equal(true)
      }
    },

    'bounceVariantUnionEnum(...) throws for a differently cased Powertrain': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceVariantUnionEnum('GAS')
      ).to.throw(
        `${testObject.constructor.name}.bounceVariantUnionEnum(...): Cannot convert "GAS" to any type in ${debugOnly(`variant<margelo::nitro::test::Powertrain, margelo::nitro::test::Car>!`)}`
      )
    },

    'bounceVariantUnionEnum(...) throws for a Car with an unknown powertrain': (testObject) => {
      expect(() =>
        testObject.bounceVariantUnionEnum({
          ...TEST_CAR,
          // @ts-expect-error
          powertrain: 'diesel',
        })
      ).to.throw(`${testObject.constructor.name}.bounceVariantUnionEnum(...): Cannot convert "[object Object]" to any type in `)
    },

    'getVariantObjects(...) resolves an object matching Person and Car to Person': (testObject) => {
      const personAndCar = { ...TEST_CAR, ...TEST_PERSON }
      expect(testObject.getVariantObjects(personAndCar)).to.deep.equal(TEST_PERSON)
    },

    'getVariantObjects(...) drops unknown keys from a Person': (testObject) => {
      const person = { ...TEST_PERSON, nickname: 'mrousavy' }
      expect(testObject.getVariantObjects(person)).to.deep.equal(TEST_PERSON)
    },

    'getVariantObjects(...) bounces a Car without optional keys': (testObject) => {
      expect(definedProperties(testObject.getVariantObjects(MINIMAL_CAR))).to.deep.equal(MINIMAL_CAR)
    },

    'getVariantObjects(...) throws for a Person without age': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects({ name: 'Marc' })
      ).to.throw(`${testObject.constructor.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `)
    },

    'getVariantObjects(...) throws for a Car without passengers': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects({ ...TEST_CAR, passengers: undefined })
      ).to.throw(`${testObject.constructor.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `)
    },

    'getVariantObjects(...) throws for an array of Persons': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects([TEST_PERSON])
      ).to.throw(`${testObject.constructor.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `)
    },

    'getVariantHybrid(...) bounces another instance of the same type': (testObject) => {
      const other = testObject.newTestObject()
      // @ts-expect-error `testObject` is a union of both TestObject types
      expect(Object.is(testObject.getVariantHybrid(other), other)).to.equal(true)
    },

    'getVariantHybrid(...) throws for the other TestObject implementation': (testObject) => {
      const otherName = testObject.constructor.name === 'TestObjectCpp' ? 'test.TestObjectSwiftKotlin' : 'test.TestObjectCpp'
      const other = new (NitroModules.getHybridClass<typeof TestObjectCpp | typeof TestObjectSwiftKotlin>(otherName))()
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybrid(other)
      ).to.throw(`${testObject.constructor.name}.getVariantHybrid(...): Cannot convert "${String(other)}" to any type in `)
    },

    'passNamedVariant(...) bounces a Car': (testObject) => {
      expect(testObject.passNamedVariant(TEST_CAR_2)).to.deep.equal(TEST_CAR_2)
    },

    'passNamedVariant(...) throws for a number': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.passNamedVariant(55)
      ).to.throw(
        `${testObject.constructor.name}.passNamedVariant(...): Cannot convert "55" to any type in ${debugOnly(`variant<std::string, margelo::nitro::test::Car>!`)}`
      )
    },

    'createChild().bounceVariant(...) bounces a Car': (testObject) => {
      expect(testObject.createChild().bounceVariant(TEST_CAR_2)).to.deep.equal(TEST_CAR_2)
    },

    'createChild().bounceVariant(...) throws for a number': (testObject) => {
      const child = testObject.createChild()
      expect(() =>
        // @ts-expect-error
        child.bounceVariant(55)
      ).to.throw(`${child.constructor.name}.bounceVariant(...): Cannot convert "55" to any type in `)
    },

    'passAllEmptyObjectVariant(...) bounces a Child as the same object': (testObject) => {
      const child = testObject.createChild()
      expect(Object.is(testObject.passAllEmptyObjectVariant(child), child)).to.equal(true)
    },

    'passAllEmptyObjectVariant(...) throws for a non-Base HybridObject': (testObject) => {
      expect(() => testObject.passAllEmptyObjectVariant(testObject)).to.throw(
        `${testObject.constructor.name}.passAllEmptyObjectVariant(...): Cannot convert "${String(testObject)}" to any type in `
      )
    },

    'passAllEmptyObjectVariant(...) throws for a wrongly typed OptionalWrapper': (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.passAllEmptyObjectVariant({ optionalString: 55 })
      ).to.throw(`${testObject.constructor.name}.passAllEmptyObjectVariant(...): Cannot convert "[object Object]" to any type in `)
    },

    'bounceComplexVariant(...) falls back to an AnyJSON for a mismatching struct': (testObject) => {
      const map = { value: 55, items: 'not-an-array' }
      expect(testObject.bounceComplexVariant(map)).to.deep.equal(map)
    },

    'bounceComplexVariant(...) accepts a number through AnyJSON': (testObject) => {
      expect(testObject.bounceComplexVariant(55)).to.equal(55)
    },
  }),
}
