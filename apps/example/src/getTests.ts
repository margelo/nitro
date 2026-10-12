import {
  type TestObjectCpp,
  type TestObjectSwiftKotlin,
  OldEnum,
  type Car,
  type Person,
  type Powertrain,
  type WrappedJsStruct,
  type OptionalWrapper,
  type OptionalEnumWrapper,
  type HardwareBufferFormat,
  WeirdNumbersEnum,
  CustomString,
  Base,
  HybridPlatformObject,
  HybridChild,
} from 'react-native-nitro-test'
import {
  type AssertionBackend,
  type State,
  createTestRunner,
  throwingBackend,
} from './testing'
import { stringify } from './utils'
import {
  getHybridObjectConstructor,
  NitroModules,
} from 'react-native-nitro-modules'
import { HybridSomeExternalObject } from 'react-native-nitro-test-external'

type TestResult =
  | {
      status: 'successful'
      result: string
    }
  | {
      status: 'failed'
      message: string
    }

export interface TestRunner {
  name: string
  run: () => Promise<TestResult>
}

// 55k allocations verify that there are no memory leaks for two reasons;
// 1) It's a lot of allocations and any VM (JS, JVM) will likely trigger GC
// 2) In JVM, 51_200 is the limit for `jni::global_ref`s, then the app crashes - this intentionally exhausts that
const MEMORY_LEAK_TEST_ALLOCATION_COUNT = 55_000
const EXTERNAL_MEMORY_TEST_SIZE = 1024 * 1024
const PARALLEL_HYBRID_OBJECT_TEST_TIMEOUT = 120_000

type HermesInternal = {
  getInstrumentedStats?: () => { js_externalBytes: number }
}

function getHermesExternalMemorySize(): number {
  const hermesInternal = (
    globalThis as typeof globalThis & { HermesInternal?: HermesInternal }
  ).HermesInternal

  if (hermesInternal?.getInstrumentedStats == null) {
    throw new Error('Hermes instrumentation is unavailable!')
  }

  return hermesInternal.getInstrumentedStats().js_externalBytes
}

/**
 * Options for getTests function
 */
export interface GetTestsOptions {
  /**
   * The assertion backend to use. Defaults to throwingBackend for in-app testing.
   */
  backend?: AssertionBackend
}

const TEST_PERSON: Person = {
  age: 24,
  name: 'Marc',
}
const TEST_CAR: Car = {
  year: 2018,
  make: 'Lamborghini',
  model: 'Huracan Performante',
  power: 640,
  powertrain: 'gas',
  driver: undefined, // <-- value needs to be explicitly set, to equal it with native's std::optional<..>
  passengers: [
    { age: 25, name: 'Sebastian' },
    { age: 27, name: 'Daniel' },
  ],
  isFast: true,
  favouriteTrack: undefined,
  performanceScores: [100, 0],
  someVariant: undefined,
}
const TEST_CAR_2: Car = {
  year: 2006,
  make: 'Mitsubishi',
  model: 'Evolution IX',
  power: 280,
  powertrain: 'gas',
  driver: TEST_PERSON,
  passengers: [
    { age: 18, name: 'Lukas' },
    { age: 23, name: 'Simon' },
  ],
  isFast: true,
  favouriteTrack: 'the road',
  performanceScores: [2, 5],
  someVariant: 'hello!',
}
const TEST_MAP: Record<string, number | boolean> = {
  someKey: 55,
  some_other_key: 123,
  a_bool: true,
  another_bool: false,
}

// All pixel-based HardwareBuffer formats and their bytes-per-pixel
const HARDWARE_BUFFER_FORMATS: {
  format: HardwareBufferFormat
  bytesPerPixel: number
}[] = [
  { format: 'rgb-565', bytesPerPixel: 2 },
  { format: 'rgba-8888', bytesPerPixel: 4 },
  { format: 'rgba-fp16', bytesPerPixel: 8 },
]

const TEST_MAP_2: Record<string, string> = {
  'someKey': 'someValue',
  'anotherKey': 'another-value',
  'third-key': 'thirdValue',
}

const TEST_MAP_3: Record<string, number> = {
  first: 14,
  second: 8247,
}

const TEST_MAP_4: Record<
  string,
  number | boolean | string | bigint | null | Array<number>
> = {
  someKey: 55,
  some_other_key: 123,
  a_bool: true,
  another_bool: false,
  a_string: 'hello',
  a_bigint: 1234567890n,
  a_null: null,
  a_array: [1, 2, 3],
}

const TEST_WRAPPED_STRUCT: WrappedJsStruct = {
  value: {
    value: 55.3,
    onChanged: (_num: number) => {},
  },
  items: [],
}
const TEST_OPTIONAL_WRAPPER: OptionalWrapper = {
  optionalArrayBuffer: new ArrayBuffer(1024),
  optionalString: 'hello!',
}
const TEST_OPTIONAL_ENUM_WRAPPER: OptionalEnumWrapper = {
  count: 7,
  weight: 1.5,
  ttl: 30000,
  jitter: 50,
  retries: 3,
  delayMs: 250,
  timeoutMs: 60000,
  ratio: 0.75,
  threshold: 100,
  enabled: true,
  active: false,
  shouldBuffer: true,
  shouldRetry: false,
  verbose: true,
  tier: 'electric',
  region: 'gas',
  stage: 'hybrid',
  tone: 'electric',
}
const TEST_CUSTOM_TYPE: CustomString = 'hello world!'

const BASE_DATE = new Date()
const DATE_PLUS_1H = (() => {
  const current = BASE_DATE.getTime()
  const oneHourInMilliseconds = 1000 * 60 * 60
  return new Date(current + oneHourInMilliseconds)
})()

const BASE = NitroModules.createHybridObject<Base>('Base')

let lotsOfCallbacks: ((num: number) => void)[] = []

function sumUpAllPassengers(cars: Car[]): string {
  return cars
    .flatMap((c) =>
      c.passengers.flatMap((p) => `${p.name} (${p.age.toFixed(0)})`)
    )
    .join(', ')
}

function createCreateTest<T>() {
  return function createTest(
    name: string,
    run: () => State<T> | Promise<State<T>>
  ): TestRunner {
    return {
      name: name,
      run: async (): Promise<TestResult> => {
        try {
          console.log(`⏳ Test "${name}" started...`)
          const state = await run()
          console.log(`✅ Test "${name}" passed!`)
          return {
            status: 'successful',
            result: stringify(state.result ?? state.errorThrown ?? '(void)'),
          }
        } catch (e) {
          console.log(`❌ Test "${name}" failed! ${e}`)
          return {
            status: 'failed',
            message: stringify(e),
          }
        }
      },
    }
  }
}

/**
 * Returns the given {@linkcode string} in debug, and `''` in release.
 * This is used for testing the C++ type names, which are obfuscated in release.
 */
function debugOnly(string: string): string {
  return NitroModules.buildType === 'debug' ? string : ''
}

export function getTests(
  testObject: TestObjectCpp | TestObjectSwiftKotlin,
  options: GetTestsOptions = {}
): TestRunner[] {
  const backend = options.backend ?? throwingBackend
  const { it } = createTestRunner(backend)
  const createTest = createCreateTest()

  return [
    // Basic prototype tests
    createTest('HybridObject.prototype is valid', () =>
      it(() => Object.getPrototypeOf(testObject))
        .didNotThrow()
        .didReturn('object')
        .toContain('simpleFunc')
    ),
    createTest('HybridObject.prototype.prototype is valid', () =>
      it(() => Object.getPrototypeOf(Object.getPrototypeOf(testObject)))
        .didNotThrow()
        .didReturn('object')
        .toContain('toString')
        .toContain('equals')
    ),
    createTest('Logging HybridObject.prototype works', () =>
      it(() => stringify(Object.getPrototypeOf(testObject)))
        .didNotThrow()
        .didReturn('string')
        .toStringContain('[empty-object HybridObject')
    ),
    createTest('Same HybridObjects are equal (a == b)', () =>
      it(
        () =>
          // eslint-disable-next-line no-self-compare
          testObject.thisObject === testObject.thisObject
      )
        .didNotThrow()
        .equals(true)
    ),
    createTest('Same HybridObjects are equal (a.equals(b))', () =>
      it(() => testObject.thisObject.equals(testObject.thisObject))
        .didNotThrow()
        .equals(true)
    ),
    createTest('Different HybridObjects are not equal (a == b)', () =>
      it(
        () =>
          // eslint-disable-next-line no-self-compare
          testObject.newTestObject() === testObject.newTestObject()
      )
        .didNotThrow()
        .equals(false)
    ),
    createTest('Different HybridObjects are not equal (a.equals(b))', () =>
      it(() => testObject.newTestObject().equals(testObject.newTestObject()))
        .didNotThrow()
        .equals(false)
    ),
    createTest("Different HybridObjects's prototypes are equal", () =>
      it(() => {
        const objA = testObject.newTestObject()
        const objB = testObject.newTestObject()
        return Object.getPrototypeOf(objA) === Object.getPrototypeOf(objB)
      })
        .didNotThrow()
        .equals(true)
    ),

    // Test Primitives (getters & setters)
    createTest('set numberValue to 13', () =>
      it(() => (testObject.numberValue = 13)).didNotThrow()
    ),
    createTest('get numberValue (== 13)', () =>
      it(() => {
        testObject.numberValue = 14
        return testObject.numberValue
      })
        .didNotThrow()
        .equals(14)
    ),
    createTest('set boolValue to true', () =>
      it(() => (testObject.boolValue = true)).didNotThrow()
    ),
    createTest('get boolValue (== true)', () =>
      it(() => {
        testObject.boolValue = true
        return testObject.boolValue
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest("set stringValue to 'hello!'", () =>
      it(() => (testObject.stringValue = 'hello!')).didNotThrow()
    ),
    createTest("get stringValue (== 'hello!')", () =>
      it(() => {
        testObject.stringValue = 'hello!'
        return testObject.stringValue
      })
        .didNotThrow()
        .equals('hello!')
    ),
    createTest('set int64Value to 7362572367826385n', () =>
      it(() => (testObject.int64Value = 7362572367826385n)).didNotThrow()
    ),
    createTest('get int64Value (== 7362572367826385n)', () =>
      it(() => {
        testObject.int64Value = 7362572367826385n
        return testObject.int64Value
      })
        .didNotThrow()
        .equals(7362572367826385n)
    ),
    createTest('set uint64Value to 7362572367826385n', () =>
      it(() => (testObject.uint64Value = 7362572367826385n)).didNotThrow()
    ),
    createTest('get uint64Value (== 7362572367826385n)', () =>
      it(() => {
        testObject.uint64Value = 7362572367826385n
        return testObject.uint64Value
      })
        .didNotThrow()
        .equals(7362572367826385n)
    ),
    createTest('set int64Value to -7362572367826385n', () =>
      it(() => (testObject.int64Value = -7362572367826385n)).didNotThrow()
    ),
    createTest('get int64Value (== -7362572367826385n)', () =>
      it(() => {
        testObject.int64Value = -7362572367826385n
        return testObject.int64Value
      })
        .didNotThrow()
        .equals(-7362572367826385n)
    ),
    createTest('set uint64Value to -7362572367826385n throws', () =>
      it(() => (testObject.uint64Value = -7362572367826385n)).didThrow()
    ),
    createTest('set stringOrUndefined to string, then undefined', () =>
      it(() => {
        testObject.stringOrUndefined = 'hello'
        testObject.stringOrUndefined = undefined
      }).didNotThrow()
    ),
    createTest('set stringOrUndefined to null throws', () =>
      it(() => {
        // @ts-expect-error
        testObject.stringOrUndefined = null
      }).didThrow()
    ),
    createTest('get stringOrUndefined (== undefined)', () =>
      it(() => {
        testObject.stringOrUndefined = undefined
        return testObject.stringOrUndefined
      })
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('set optionalString to string, then undefined', () =>
      it(() => {
        testObject.optionalString = 'hello'
        testObject.optionalString = undefined
      }).didNotThrow()
    ),
    createTest('get optionalString (== undefined)', () =>
      it(() => {
        testObject.optionalString = undefined
        return testObject.optionalString
      })
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('set nullValue to null', () =>
      it(() => {
        testObject.nullValue = null
      }).didNotThrow()
    ),
    createTest('set nullValue to undefined throws', () =>
      it(() => {
        // @ts-expect-error
        testObject.nullValue = undefined
      }).didThrow()
    ),
    createTest('set nullValue to a number throws', () =>
      it(() => {
        // @ts-expect-error
        testObject.nullValue = 19
      }).didThrow()
    ),
    createTest('get nullValue (== null)', () =>
      it(() => {
        return testObject.nullValue
      })
        .didNotThrow()
        .equals(null)
    ),
    createTest('set stringOrNull to string, then null', () =>
      it(() => {
        testObject.stringOrNull = 'hello'
        testObject.stringOrNull = null
      }).didNotThrow()
    ),
    createTest('get stringOrNull (== null)', () =>
      it(() => {
        testObject.stringOrNull = null
        return testObject.stringOrNull
      })
        .didNotThrow()
        .equals(null)
    ),
    createTest('get optionalArray (== undefined)', () =>
      it(() => {
        testObject.optionalArray = undefined
        return testObject.optionalArray
      })
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('get optionalArray (== ["hello", "world"])', () =>
      it(() => {
        testObject.optionalArray = ['hello', 'world']
        return testObject.optionalArray
      })
        .didNotThrow()
        .equals(['hello', 'world'])
    ),
    createTest('get optionalHybrid (== undefined)', () =>
      it(() => {
        testObject.optionalHybrid = undefined
        return testObject.optionalHybrid
      })
        .didNotThrow()
        .didReturn('undefined')
    ),
    createTest('get optionalHybrid (== self)', () =>
      it(() => {
        testObject.optionalHybrid = testObject
        return testObject.optionalHybrid
      })
        .didNotThrow()
        .didReturn('object')
        // @ts-expect-error
        .equals(testObject.optionalHybrid)
        .cleanup(() => {
          testObject.optionalHybrid = undefined
        })
    ),
    createTest('get optionalEnum (== undefined)', () =>
      it(() => {
        testObject.optionalEnum = undefined
        return testObject.optionalEnum
      })
        .didNotThrow()
        .didReturn('undefined')
    ),
    createTest('get optionalEnum (== self)', () =>
      it(() => {
        testObject.optionalEnum = 'gas'
        return testObject.optionalEnum
      })
        .didNotThrow()
        .didReturn('string')
        .equals('gas')
    ),
    createTest('get optionalOldEnum (== undefined)', () =>
      it(() => {
        testObject.optionalOldEnum = undefined
        return testObject.optionalOldEnum
      })
        .didNotThrow()
        .didReturn('undefined')
    ),
    createTest('get optionalOldEnum (== self)', () =>
      it(() => {
        testObject.optionalOldEnum = OldEnum.SECOND
        return testObject.optionalOldEnum
      })
        .didNotThrow()
        .didReturn(typeof OldEnum.SECOND)
        .equals(OldEnum.SECOND)
    ),
    createTest('get hasBoolean', () =>
      it(() => {
        return testObject.hasBoolean
      })
        .didNotThrow()
        .equals(false)
    ),
    createTest('set + get hasBooleanWritable', () =>
      it(() => {
        testObject.hasBooleanWritable = true
        return testObject.hasBooleanWritable
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('get isBoolean', () =>
      it(() => {
        return testObject.isBoolean
      })
        .didNotThrow()
        .equals(false)
    ),
    createTest('set + get isBooleanWritable', () =>
      it(() => {
        testObject.isBooleanWritable = true
        return testObject.isBooleanWritable
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('set + get isolatedBoolean', () =>
      it(() => {
        testObject.isolatedBoolean = true
        return testObject.isolatedBoolean
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('set + get isTextValue', () =>
      it(() => {
        testObject.isTextValue = 'hello'
        return testObject.isTextValue
      })
        .didNotThrow()
        .equals('hello')
    ),
    createTest('set optionalCallback, then undefined', () =>
      it(() => {
        testObject.optionalCallback = () => {}
        testObject.optionalCallback = undefined
      }).didNotThrow()
    ),
    createTest('get optionalCallback (== self)', () =>
      it(() => {
        testObject.optionalCallback = () => {}
        return testObject.optionalCallback
      })
        .didNotThrow()
        .didReturn('function')
    ),

    // Test basic functions
    createTest('addNumbers(5, 13) = 18', () =>
      it(() => testObject.addNumbers(5, 13))
        .didNotThrow()
        .equals(18)
    ),
    createTest('addStrings("hello ", "world") = "hello world"', () =>
      it(() => testObject.addStrings('hello ', 'world'))
        .didNotThrow()
        .equals('hello world')
    ),
    createTest('simpleFunc()', () =>
      it(() => testObject.simpleFunc())
        .didNotThrow()
        .didReturn('undefined')
    ),
    createTest('multipleArguments(...)', () =>
      it(() => testObject.multipleArguments(13, 'hello!', true))
        .didNotThrow()
        .didReturn('undefined')
    ),
    createTest('bounceNull(...) works with null', () =>
      it(() => testObject.bounceNull(null))
        .didNotThrow()
        .equals(null)
    ),
    createTest('bounceNull(...) throws at undefined', () =>
      it(() =>
        // @ts-expect-error
        testObject.bounceNull(undefined)
      ).didThrow()
    ),

    // Arrays
    createTest('bounceNumbers(...) equals', () =>
      it(() => testObject.bounceNumbers([1, 2, 13, 42]))
        .didNotThrow()
        .didReturn('object')
        .equals([1, 2, 13, 42])
    ),
    createTest('bounceStrings(...) equals simple strings', () =>
      it(() => testObject.bounceStrings(['hello', 'world', '!']))
        .didNotThrow()
        .didReturn('object')
        .equals(['hello', 'world', '!'])
    ),
    createTest('bounceStrings(...) equals unicode/emojis', () =>
      it(() => testObject.bounceStrings(['✨', '🔥', `🥳🥷🏼🥳`]))
        .didNotThrow()
        .didReturn('object')
        .equals(['✨', '🔥', `🥳🥷🏼🥳`])
    ),
    createTest('bounceOptionals(...) keeps undefined elements', () =>
      it(() =>
        testObject.bounceOptionals(
          ['hello', undefined, 'world'],
          [new ArrayBuffer(16), undefined]
        )
      )
        .didNotThrow()
        .didReturn('object')
        .equals(['hello', undefined, 'world'])
    ),
    createTest('bounceNulls(...) keeps null elements', () =>
      it(() => testObject.bounceNulls(['hello', null, 'world']))
        .didNotThrow()
        .didReturn('object')
        .equals(['hello', null, 'world'])
    ),
    createTest(
      'bounceOptionalNulls(...) keeps null and undefined elements',
      () =>
        it(() => testObject.bounceOptionalNulls(['hello', null, undefined]))
          .didNotThrow()
          .didReturn('object')
          .equals(['hello', null, undefined])
    ),
    createTest('bounceEnums(...) equals', () =>
      it(() => testObject.bounceEnums(['gas', 'hybrid']))
        .didNotThrow()
        .didReturn('object')
        .equals(['gas', 'hybrid'])
    ),
    createTest('bounceStructs(...) equals', () =>
      it(() =>
        testObject.bounceStructs([
          { age: 24, name: 'Marc' },
          { age: 5, name: 'Ben' },
        ])
      )
        .didNotThrow()
        .didReturn('object')
        .equals([
          { age: 24, name: 'Marc' },
          { age: 5, name: 'Ben' },
        ])
    ),
    createTest('bounceNestedArray(...) equals', () =>
      it(() =>
        testObject.bounceNestedArray([
          [
            { age: 24, name: 'Marc' },
            { age: 5, name: 'Ben' },
          ],
          [{ age: 30, name: 'Anna' }],
          [],
        ])
      )
        .didNotThrow()
        .didReturn('object')
        .equals([
          [
            { age: 24, name: 'Marc' },
            { age: 5, name: 'Ben' },
          ],
          [{ age: 30, name: 'Anna' }],
          [],
        ])
    ),
    createTest('bouncePartialStruct(...) empty equals', () =>
      it(() =>
        testObject.bouncePartialStruct({ name: undefined, age: undefined })
      )
        .didNotThrow()
        .didReturn('object')
        .equals({ name: undefined, age: undefined })
    ),
    createTest('bouncePartialStruct(...) with 1 key equals', () =>
      it(() => testObject.bouncePartialStruct({ name: 'Marc', age: undefined }))
        .didNotThrow()
        .didReturn('object')
        .equals({ name: 'Marc', age: undefined })
    ),
    createTest('bouncePartialStruct(...) with all keys equals', () =>
      it(() => testObject.bouncePartialStruct({ name: 'Marc', age: 25 }))
        .didNotThrow()
        .didReturn('object')
        .equals({ name: 'Marc', age: 25 })
    ),
    createTest('sumUpAllPassengers(...) equals', () =>
      it(() => testObject.sumUpAllPassengers([TEST_CAR, TEST_CAR_2]))
        .didNotThrow()
        .didReturn('string')
        .equals(sumUpAllPassengers([TEST_CAR, TEST_CAR_2]))
    ),
    createTest('bounceWrappedJsStyleStruct(...) equals', () =>
      it(() => testObject.bounceWrappedJsStyleStruct(TEST_WRAPPED_STRUCT))
        .didNotThrow()
        .didReturn('object')
        // TODO: We can't do .equals(...) here because of how Functions are deep-equal'd
        .toContain('value')
    ),
    createTest('bounceOptionalWrapper(...) equals', () =>
      it(() => testObject.bounceOptionalWrapper(TEST_OPTIONAL_WRAPPER))
        .didNotThrow()
        .didReturn('object')
        .equals(TEST_OPTIONAL_WRAPPER)
    ),
    createTest('bounceOptionalEnumStruct(...) equals', () =>
      it(() => testObject.bounceOptionalEnumStruct(TEST_OPTIONAL_ENUM_WRAPPER))
        .didNotThrow()
        .didReturn('object')
        .equals(TEST_OPTIONAL_ENUM_WRAPPER)
    ),
    createTest('bounceOptionalEnumStruct(...) undefined', () =>
      it(() => testObject.bounceOptionalEnumStruct(undefined))
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('bounceOptionalCallback(...) works for function', () =>
      it(
        () => testObject.bounceOptionalCallback({ callback: () => {} }).callback
      )
        .didNotThrow()
        .didReturn('function')
    ),
    createTest('bounceOptionalCallback(...) works for number', () =>
      it(() => testObject.bounceOptionalCallback({ callback: 55 }).callback)
        .didNotThrow()
        .didReturn('number')
    ),
    createTest('bounceOptionalCallback(...) works for undefined', () =>
      it(() => testObject.bounceOptionalCallback({}).callback)
        .didNotThrow()
        .didReturn('undefined')
    ),
    createTest('createOptionalPrimitivesHolder(5, ...)', async () =>
      it(() => HybridSomeExternalObject.createOptionalPrimitivesHolder(5))
        .didNotThrow()
        .equals({
          optionalNumber: 5,
          optionalBoolean: undefined,
          optionalUInt64: undefined,
          optionalInt64: undefined,
        })
    ),
    createTest('createOptionalPrimitivesHolder(..., true, ...)', async () =>
      it(() =>
        HybridSomeExternalObject.createOptionalPrimitivesHolder(undefined, true)
      )
        .didNotThrow()
        .equals({
          optionalNumber: undefined,
          optionalBoolean: true,
          optionalUInt64: undefined,
          optionalInt64: undefined,
        })
    ),
    createTest('createOptionalPrimitivesHolder(...)', async () =>
      it(() => HybridSomeExternalObject.createOptionalPrimitivesHolder())
        .didNotThrow()
        .equals({
          optionalNumber: undefined,
          optionalBoolean: undefined,
          optionalUInt64: undefined,
          optionalInt64: undefined,
        })
    ),
    createTest('createOptionalPrimitivesHolder(ALL)', async () =>
      it(() =>
        HybridSomeExternalObject.createOptionalPrimitivesHolder(
          5,
          true,
          7n,
          13n
        )
      )
        .didNotThrow()
        .equals({
          optionalNumber: 5,
          optionalBoolean: true,
          optionalUInt64: 7n,
          optionalInt64: 13n,
        })
    ),

    createTest('complexEnumCallback(...)', async () =>
      (
        await it<Powertrain[]>(() => {
          return new Promise((resolve) => {
            testObject.complexEnumCallback(['gas', 'electric'], (result) => {
              resolve(result)
            })
          })
        })
      )
        .didNotThrow()
        .equals(['gas', 'electric'])
    ),
    createTest('bounceHybridObjects(...)', () =>
      it(() => testObject.bounceHybridObjects([HybridChild, HybridChild]))
        .didNotThrow()
        .equals([HybridChild, HybridChild])
    ),
    createTest('bounceFunctions(...)', () =>
      it(() => testObject.bounceFunctions([() => {}, () => {}]))
        .didNotThrow()
        .toBeArray()
        .toContain(0)
        .toContain(1)
    ),
    createTest('bounceMaps(...)', () =>
      it(() => testObject.bounceMaps([TEST_MAP, TEST_MAP_2]))
        .didNotThrow()
        .equals([TEST_MAP, TEST_MAP_2])
    ),
    createTest('bouncePromises(...)', () =>
      it(() =>
        testObject.bouncePromises([(async () => 55)(), Promise.resolve(13)])
      )
        .didNotThrow()
        .toBeArray()
        .toContain(0)
        .toContain(1)
    ),
    createTest('bounceArrayBuffers(...)', () =>
      it(() =>
        testObject.bounceArrayBuffers([
          testObject.createArrayBuffer(),
          testObject.createArrayBufferFromNativeBuffer(false),
          testObject.createArrayBufferFromNativeBuffer(true),
          new ArrayBuffer(50),
        ])
      )
        .didNotThrow()
        .toBeArray()
        .toContain(0)
        .toContain(1)
        .toContain(2)
        .toContain(3)
    ),

    // Test Dates
    createTest('currentDate(...) is a Date', () =>
      it(() => {
        const now = testObject.currentDate()
        return now instanceof Date
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('add1Hour(...)', () =>
      it(() => {
        const added = testObject.add1Hour(BASE_DATE)
        return added.getTime()
      })
        .didNotThrow()
        .equals(DATE_PLUS_1H.getTime())
    ),
    createTest('currentDate(...) is roughly same JS value', () =>
      it(() => {
        const nativeNow = testObject.currentDate()
        const jsNow = new Date()
        const msDiff = Math.abs(jsNow.getTime() - nativeNow.getTime())
        return msDiff < 10
      })
        .didNotThrow()
        .equals(true)
    ),

    // Test Maps
    createTest('createMap()', () =>
      it(() => testObject.createMap())
        .didNotThrow()
        .didReturn('object')
        .toContain('object')
        .toContain('array')
        .toContain('null')
        .toContain('int64')
        .toContain('string')
        .toContain('bool')
        .toContain('number')
    ),
    createTest('createMap().array', () =>
      it(() => testObject.createMap().array)
        .didNotThrow()
        .didReturn('object')
        .equals([
          testObject.numberValue,
          testObject.boolValue,
          testObject.stringValue,
          testObject.int64Value,
        ])
    ),
    createTest('createMap().object', () =>
      it(() => testObject.createMap().object)
        .didNotThrow()
        .didReturn('object')
        .equals({
          array: [
            testObject.numberValue,
            testObject.boolValue,
            testObject.stringValue,
            testObject.int64Value,
            [
              testObject.numberValue,
              testObject.boolValue,
              testObject.stringValue,
              testObject.int64Value,
            ],
          ],
          int64: testObject.int64Value,
          bool: testObject.boolValue,
          string: testObject.stringValue,
          number: testObject.numberValue,
          null: null,
        })
    ),
    createTest('mapRoundtrip(...) works', () => {
      const map = testObject.createMap()
      return it(() => testObject.mapRoundtrip(map))
        .didNotThrow()
        .equals(map)
    }),
    createTest('getMapKeys(...) works', () => {
      const map = testObject.createMap()
      const targetKeys = [...Object.keys(map)].sort()
      return it(() => {
        const keys = testObject.getMapKeys(map)
        return [...keys].sort()
      })
        .didNotThrow()
        .equals(targetKeys)
    }),
    createTest('mergeMaps(...) works', () =>
      it(() => testObject.mergeMaps(TEST_MAP, TEST_MAP_2))
        .didNotThrow()
        .equals({ ...TEST_MAP, ...TEST_MAP_2 })
    ),
    createTest('copyAnyMap(...) works', () =>
      it(() => testObject.copyAnyMap(TEST_MAP_4))
        .didNotThrow()
        .equals(TEST_MAP_4)
    ),

    // Test errors
    createTest('funcThatThrows() throws', () =>
      it(() => testObject.funcThatThrows())
        // contains the method name:
        .didThrow(`${testObject.name}.funcThatThrows(...):`)
        // contains the error message:
        .didThrow(`This function will only work after sacrificing seven lambs!`)
    ),
    createTest('funcThatThrowsBeforePromise() throws', async () =>
      (await it(async () => await testObject.funcThatThrowsBeforePromise()))
        // contains the method name:
        .didThrow(`${testObject.name}.funcThatThrowsBeforePromise(...):`)
        // contains the error message:
        .didThrow(`This function will only work after sacrificing eight lambs!`)
    ),
    createTest('throwError(error) throws same message from JS', () =>
      it(() => {
        const error = new Error('rethrowing a JS error from native!')
        testObject.throwError(error)
      })
        // contains the method name:
        .didThrow(`${testObject.name}.throwError(...):`)
        // contains the error message:
        .didThrow(`Error: rethrowing a JS error from native!`)
    ),

    // Optional parameters
    createTest('tryOptionalParams(...) omitted', () =>
      it(() => testObject.tryOptionalParams(13, true))
        .didNotThrow()
        .didReturn('string')
        .equals('value omitted!')
    ),
    createTest('tryOptionalParams(...) provided', () =>
      it(() => testObject.tryOptionalParams(13, true, 'hello'))
        .didNotThrow()
        .didReturn('string')
        .equals('hello')
    ),
    createTest('tryOptionalParams(...) one-too-many', () =>
      it(() =>
        testObject.tryOptionalParams(
          13,
          true,
          'hello',
          // @ts-expect-error
          'too many args!'
        )
      )
        // thrown by HybridFunction, not by the user;
        .didThrow(
          `Error: \`${testObject.name}.tryOptionalParams(...)\` expected between 2 and 3 arguments, but received 4!`
        )
    ),
    createTest('tryOptionalParams(...) one-too-few', () =>
      it(() =>
        // @ts-expect-error
        testObject.tryOptionalParams(13)
      )
        // thrown by HybridFunction, not by the user;
        .didThrow(
          `Error: \`${testObject.name}.tryOptionalParams(...)\` expected between 2 and 3 arguments, but received 1!`
        )
    ),
    createTest('tryMiddleParam(...) undefined', () =>
      it(() => testObject.tryMiddleParam(13, undefined, 'hello!'))
        .didNotThrow()
        .equals('hello!')
    ),
    createTest('tryMiddleParam(...) true', () =>
      it(() => testObject.tryMiddleParam(13, true, 'passed'))
        .didNotThrow()
        .equals('passed')
    ),
    createTest('tryOptionalEnum(...) gas', () =>
      it(() => testObject.tryOptionalEnum('gas'))
        .didNotThrow()
        .equals('gas')
    ),
    createTest('tryOptionalEnum(...) undefined', () =>
      it(() => testObject.tryOptionalEnum(undefined))
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('tryTrailingOptional(...) false', () =>
      it(() => testObject.tryTrailingOptional(0, '', false))
        .didNotThrow()
        .equals(false)
    ),
    createTest('tryTrailingOptional(...) true', () =>
      it(() => testObject.tryTrailingOptional(0, '', true))
        .didNotThrow()
        .equals(true)
    ),

    // Variants tests
    createTest('set someVariant to 55', () =>
      it(() => (testObject.someVariant = 55)).didNotThrow()
    ),
    createTest('get someVariant (== 55)', () =>
      it(() => {
        testObject.someVariant = 55
        return testObject.someVariant
      }).equals(55)
    ),
    createTest("set someVariant to 'some-string'", () =>
      it(() => (testObject.someVariant = 'some-string')).didNotThrow()
    ),
    createTest("get someVariant (== 'some-string')", () =>
      it(() => {
        testObject.someVariant = 'some-string'
        return testObject.someVariant
      }).equals('some-string')
    ),
    createTest('set someVariant to false', () =>
      it(
        () =>
          // @ts-expect-error
          (testObject.someVariant = false)
      ).didThrow(
        `Error: ${testObject.name}.someVariant: Cannot convert "false" to any type in ${debugOnly('variant<double, std::string>!')}`
      )
    ),

    createTest('passVariant(...) holds something else ([1,2,3])', () =>
      it(() => testObject.passVariant([1, 2, 3]))
        .didNotThrow()
        .equals('holds something else!')
    ),
    createTest('passVariant(...) holds string(hello!)', () =>
      it(() => testObject.passVariant('hello!'))
        .didNotThrow()
        .equals('hello!')
    ),
    createTest('passVariant(...) holds number (5)', () =>
      it(() => testObject.passVariant(5))
        .didNotThrow()
        .equals(5)
    ),
    createTest('passVariant(...) wrong type ({})', () =>
      it(() =>
        testObject.passVariant(
          // @ts-expect-error
          {}
        )
      ).didThrow()
    ),
    createTest('passAllEmptyObjectVariant(...) with empty obj ({})', () =>
      it(() => testObject.passAllEmptyObjectVariant({}))
        .didNotThrow()
        .didReturn('object')
    ),
    createTest('passAllEmptyObjectVariant(...) with first obj', () =>
      it(() =>
        testObject.passAllEmptyObjectVariant({
          optionalString: 'optional string!',
        })
      )
        .didNotThrow()
        .didReturn('object')
        // @ts-expect-error idk why this keyof is `never`...
        .toContain('optionalString')
    ),
    createTest('passAllEmptyObjectVariant(...) with second obj', () =>
      it(() => testObject.passAllEmptyObjectVariant(BASE))
        .didNotThrow()
        .didReturn('object')
        .equals(BASE)
    ),
    createTest('bounceComplexVariant(...) with ArrayBuffer', () =>
      it(() => testObject.bounceComplexVariant(testObject.createArrayBuffer()))
        .didNotThrow()
        .didReturn('object')
        .isInstanceOf(ArrayBuffer)
    ),
    createTest('bounceComplexVariant(...) with Promise', async () =>
      (
        await it(async () => {
          const result = testObject.bounceComplexVariant(
            new Promise<number>((resolve) => {
              setTimeout(() => resolve(55), 100)
            })
          )
          if (!(result instanceof Promise))
            throw new Error(`Not a Promise! (${stringify(result)})`)
          return await result
        })
      )
        .didNotThrow()
        .didReturn('number')
        .equals(55)
    ),
    createTest('bounceComplexVariant(...) with Callback', () =>
      it(() => testObject.bounceComplexVariant(() => {}))
        .didNotThrow()
        .didReturn('function')
    ),
    createTest('bounceComplexVariant(...) with struct', () =>
      it(() =>
        testObject.bounceComplexVariant({
          items: [],
          value: { onChanged: () => {}, value: 55 },
        })
      )
        .didNotThrow()
        .didReturn('object')
        // @ts-expect-error
        .toContain('items')
        // @ts-expect-error
        .toContain('value')
    ),
    createTest('bounceComplexVariant(...) with AnyMap', () =>
      it(() => testObject.bounceComplexVariant({ whateverValue: 55 }))
        .didNotThrow()
        .didReturn('object')
        // @ts-expect-error
        .toContain('whateverValue')
        .equals({ whateverValue: 55 })
    ),
    createTest('bounceComplexVariant(...) with Date', () =>
      it(() => testObject.bounceComplexVariant(new Date()))
        .didNotThrow()
        .didReturn('object')
        .isInstanceOf(Date)
    ),
    createTest('createChild().bounceVariant(...) works', () =>
      it(() => testObject.createChild().bounceVariant('hello!'))
        .didNotThrow()
        .equals('hello!')
    ),
    // Complex variants tests
    createTest('getVariantEnum(...) converts enum', () =>
      it(() => testObject.getVariantEnum(OldEnum.THIRD))
        .didNotThrow()
        .equals(OldEnum.THIRD)
    ),
    createTest('getVariantEnum(...) converts boolean', () =>
      it(() => testObject.getVariantEnum(true))
        .didNotThrow()
        .equals(true)
    ),
    createTest('getVariantEnum(...) throws at wrong type (string)', () =>
      // @ts-expect-error
      it(() => testObject.getVariantEnum('string')).didThrow(
        `Error: ${testObject.name}.getVariantEnum(...): Cannot convert "string" to any type in ${debugOnly('variant<margelo::nitro::test::OldEnum, bool>!')}`
      )
    ),
    createTest('getVariantEnum(...) throws at too high numerical value', () =>
      // @ts-expect-error
      it(() => testObject.getVariantEnum(9999)).didThrow(
        `Error: ${testObject.name}.getVariantEnum(...): Cannot convert "9999" to any type in ${debugOnly('variant<margelo::nitro::test::OldEnum, bool>!')}`
      )
    ),
    createTest("bounceVariantUnionEnum(...) converts 'gas'", () =>
      it(() => testObject.bounceVariantUnionEnum('gas'))
        .didNotThrow()
        .equals('gas')
    ),
    createTest('bounceVariantUnionEnum(...) converts Car', () =>
      it(() => testObject.bounceVariantUnionEnum(TEST_CAR))
        .didNotThrow()
        .equals(TEST_CAR)
    ),
    createTest('bounceVariantUnionEnum(...) throws at wrong string', () =>
      // @ts-expect-error
      it(() => testObject.bounceVariantUnionEnum('diesel')).didThrow()
    ),
    createTest('bounceVariantUnionEnum(...) throws at wrong object', () =>
      // @ts-expect-error
      it(() => testObject.bounceVariantUnionEnum({})).didThrow()
    ),
    createTest(
      'bounceVariantUnionEnum(...) throws at wrong type (boolean)',
      () =>
        // @ts-expect-error
        it(() => testObject.bounceVariantUnionEnum(true)).didThrow()
    ),
    createTest('getVariantWeirdNumbersEnum(...) converts enum', () =>
      it(() => testObject.getVariantWeirdNumbersEnum(WeirdNumbersEnum.C))
        .didNotThrow()
        .equals(WeirdNumbersEnum.C)
    ),
    createTest('getVariantWeirdNumbersEnum(...) converts boolean', () =>
      it(() => testObject.getVariantWeirdNumbersEnum(true))
        .didNotThrow()
        .equals(true)
    ),
    createTest(
      'getVariantWeirdNumbersEnum(...) throws at wrong type (string)',
      () =>
        // @ts-expect-error
        it(() => testObject.getVariantWeirdNumbersEnum('string')).didThrow(
          `Error: ${testObject.name}.getVariantWeirdNumbersEnum(...): Cannot convert "string" to any type in ${debugOnly('variant<margelo::nitro::test::WeirdNumbersEnum, bool>!')}`
        )
    ),
    createTest(
      'getVariantWeirdNumbersEnum(...) throws at too high numerical value',
      () =>
        // @ts-expect-error
        it(() => testObject.getVariantWeirdNumbersEnum(99999)).didThrow(
          `Error: ${testObject.name}.getVariantWeirdNumbersEnum(...): Cannot convert "99999" to any type in ${debugOnly('variant<margelo::nitro::test::WeirdNumbersEnum, bool>!')}`
        )
    ),
    createTest('getVariantObjects(...) converts Person', () =>
      it(() => testObject.getVariantObjects(TEST_PERSON))
        .didNotThrow()
        .equals(TEST_PERSON)
    ),
    createTest('getVariantObjects(...) converts Car', () =>
      it(() => testObject.getVariantObjects(TEST_CAR))
        .didNotThrow()
        .equals(TEST_CAR)
    ),
    createTest('getVariantObjects(...) converts Car (+ person)', () =>
      it(() =>
        testObject.getVariantObjects({ ...TEST_CAR, driver: TEST_PERSON })
      )
        .didNotThrow()
        .equals({ ...TEST_CAR, driver: TEST_PERSON })
    ),
    createTest('getVariantObjects(...) throws at wrong type (string)', () =>
      // @ts-expect-error
      it(() => testObject.getVariantObjects('some-string')).didThrow(
        `Error: ${testObject.name}.getVariantObjects(...): Cannot convert "some-string" to any type in ${debugOnly('variant<margelo::nitro::test::Person, margelo::nitro::test::Car>!')}`
      )
    ),
    createTest(
      'getVariantObjects(...) throws at wrong type (wrong object)',
      () =>
        it(() =>
          // @ts-expect-error
          testObject.getVariantObjects({ someValue: 55 })
        ).didThrow(
          `Error: ${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in ${debugOnly('variant<margelo::nitro::test::Person, margelo::nitro::test::Car>!')}`
        )
    ),
    createTest('getVariantHybrid(...) converts Hybrid', () =>
      // @ts-expect-error TypeScript spazzes out since it can be both types of HybridObject
      it(() => testObject.getVariantHybrid(testObject))
        .didNotThrow()
        // @ts-expect-error
        .toContain('getVariantHybrid')
    ),
    createTest('getVariantHybrid(...) converts Person', () =>
      it(() => testObject.getVariantHybrid(TEST_PERSON))
        .didNotThrow()
        .equals(TEST_PERSON)
    ),
    createTest('getVariantHybrid(...) throws at wrong type (string)', () =>
      // @ts-expect-error
      it(() => testObject.getVariantHybrid('some-string')).didThrow()
    ),
    createTest(
      'getVariantHybrid(...) throws at wrong type (wrong object)',
      () =>
        it(() =>
          // @ts-expect-error
          testObject.getVariantHybrid({ someValue: 55 })
        ).didThrow()
    ),
    createTest('passNamedVariant(...) works', () =>
      it(() => testObject.passNamedVariant('Hello world!'))
        .didNotThrow()
        .equals('Hello world!')
    ),
    createTest('bounceVehicle(truck) works', () =>
      it(() => testObject.bounceVehicle({ kind: 'truck', payload: 1000 }))
        .didNotThrow()
        .equals({ kind: 'truck', payload: 1000 })
    ),
    createTest('bounceVehicle(boat) works', () =>
      it(() => testObject.bounceVehicle({ kind: 'boat', lengthMeters: 12.5 }))
        .didNotThrow()
        .equals({ kind: 'boat', lengthMeters: 12.5 })
    ),

    // More complex variants...
    ...('getVariantTuple' in testObject
      ? [
          createTest('getVariantTuple(...) converts Float2', () =>
            it(() => testObject.getVariantTuple([10, 20]))
              .didNotThrow()
              .equals([10, 20])
          ),
          createTest('getVariantTuple(...) converts Float3', () =>
            it(() => testObject.getVariantTuple([10, 20, 30]))
              .didNotThrow()
              .equals([10, 20, 30])
          ),
          createTest(
            'getVariantTuple(...) throws at wrong size (4 items)',
            () =>
              it(() =>
                // @ts-expect-error
                testObject.getVariantTuple([10, 20, 30, 40, 50])
              ).didThrow()
          ),
          createTest('getVariantTuple(...) throws at wrong type (string)', () =>
            // @ts-expect-error
            it(() => testObject.getVariantTuple('hello')).didThrow()
          ),
          createTest(
            'getVariantTuple(...) throws at wrong type (string[])',
            () =>
              it(() =>
                // @ts-expect-error
                testObject.getVariantTuple(['hello', 'world'])
              ).didThrow()
          ),
        ]
      : [
          // Swift/Kotlin test object does not have variants yet.
        ]),

    // Tuples Tests
    ...('someTuple' in testObject
      ? [
          createTest("set someTuple to [55, 'hello']", () =>
            it(() => (testObject.someTuple = [55, 'hello'])).didNotThrow()
          ),
          createTest("get someTuple (== [55, 'hello'])", () =>
            it(() => {
              testObject.someTuple = [55, 'hello']
              return testObject.someTuple
            }).equals([55, 'hello'])
          ),
          createTest('flip([10, 20, 30])', () =>
            it(() => testObject.flip([10, 20, 30]))
              .didNotThrow()
              .equals([30, 20, 10])
          ),
          createTest('flip([10, 20]) throws', () =>
            it(() =>
              testObject.flip(
                // @ts-expect-error
                [10, 20]
              )
            )
              .didThrow(
                `Error: ${testObject.name}.flip(...): The given JS Array has 2 items, but ${debugOnly('std::tuple<double, double, double>')}`
              )
              .didThrow('expects 3 items')
          ),
          createTest('passTuple(...)', () =>
            it(() => testObject.passTuple([13, 'hello', true]))
              .didNotThrow()
              .equals([13, 'hello', true])
          ),
        ]
      : [
          // Swift/Kotlin Test Object does not have tuples yet!
        ]),

    // Custom Types tests
    ...('bounceCustomType' in testObject
      ? [
          createTest('bounceCustomType(...) works', () =>
            it(() => testObject.bounceCustomType(TEST_CUSTOM_TYPE))
              .didNotThrow()
              .equals(TEST_CUSTOM_TYPE)
          ),
        ]
      : [
          // Swift/Kotlin Test Object does not have CustomTypes!
        ]),

    // AnyHybridObject test
    ...('bounceAnyHybrid' in testObject
      ? [
          createTest('bounceAnyHybrid(...) works', () =>
            it(() => testObject.bounceAnyHybrid(HybridSomeExternalObject))
              .didNotThrow()
              .equals(HybridSomeExternalObject)
          ),
          createTest(
            'bounceAnyHybrid(...) different object does not equal',
            () =>
              it(() => {
                const external = testObject.bounceAnyHybrid(
                  HybridSomeExternalObject
                )
                return external.equals(testObject)
              })
                .didNotThrow()
                .equals(false)
          ),
        ]
      : [
          // Swift/Kotlin Test Object does not have CustomTypes!
        ]),

    createTest('bounceMap(map) === map', () =>
      it(() => testObject.bounceMap(TEST_MAP))
        .didNotThrow()
        .didReturn('object')
        .equals(TEST_MAP)
    ),
    createTest('bounceSimpleMap(map) === map', () =>
      it(() => testObject.bounceSimpleMap(TEST_MAP_3))
        .didNotThrow()
        .didReturn('object')
        .equals(TEST_MAP_3)
    ),
    createTest('bounceOptionalMap(map) keeps undefined values', () =>
      it(() => testObject.bounceOptionalMap({ a: 'b', c: undefined }))
        .didNotThrow()
        .didReturn('object')
        .equals({ a: 'b', c: undefined })
    ),
    createTest('bounceNullMap(map) keeps null values', () =>
      it(() => testObject.bounceNullMap({ a: 'b', c: null }))
        .didNotThrow()
        .didReturn('object')
        .equals({ a: 'b', c: null })
    ),
    createTest(
      'bounceOptionalNullMap(map) keeps null and undefined values',
      () =>
        it(() =>
          testObject.bounceOptionalNullMap({ a: 'b', b: null, c: undefined })
        )
          .didNotThrow()
          .didReturn('object')
          .equals({ a: 'b', b: null, c: undefined })
    ),
    createTest('extractMap(mapWrapper) === mapWrapper.map', () =>
      it(() =>
        testObject.extractMap({
          map: TEST_MAP_2,
          secondMap: { second: TEST_MAP_2 },
        })
      )
        .didNotThrow()
        .didReturn('object')
        .equals(TEST_MAP_2)
    ),

    // Promises
    createTest('wait', async () =>
      (await it(() => testObject.wait(0.1))).didNotThrow()
    ),
    createTest('calculateFibonacciSync(5)', async () =>
      it(() => testObject.calculateFibonacciSync(10))
        .didNotThrow()
        .equals(55n)
    ),
    createTest('calculateFibonacciAsync(5)', async () =>
      (await it(() => testObject.calculateFibonacciAsync(10)))
        .didNotThrow()
        .equals(55n)
    ),
    createTest('promiseThrows() throws', async () =>
      (await it(() => testObject.promiseThrows())).didThrow(
        'Error: Promise throws :)'
      )
    ),
    createTest('promiseReturnsInstantly() works', async () =>
      (await it(() => testObject.promiseReturnsInstantly()))
        .didNotThrow()
        .equals(55)
    ),
    createTest('promiseReturnsInstantlyAsync() works', async () =>
      (await it(() => testObject.promiseReturnsInstantlyAsync()))
        .didNotThrow()
        .equals(55)
    ),
    createTest(
      'promiseReturnsInstantlyAsync() works under parallel load',
      async () =>
        (
          await it(async () => {
            const results = await Promise.all(
              Array.from({ length: 100 }, () =>
                testObject.promiseReturnsInstantlyAsync()
              )
            )
            return results.every((result) => result === 55)
          })
        )
          .didNotThrow()
          .equals(true)
    ),
    createTest(
      'newTestObjectAsync() under parallel load does not data-race (run under Thread Sanitizer)',
      async () =>
        (
          await it(async () => {
            // Resolves a HybridObject off the JS thread; the race is between resolve() and
            // JSIConverter::toJSI reading Promise state on the JS thread. Passes functionally;
            // the verdict is Thread Sanitizer.
            for (let round = 0; round < 20; round++) {
              await Promise.all(
                Array.from({ length: 32 }, () =>
                  testObject.newTestObjectAsync()
                )
              )
            }
            return true
          }, PARALLEL_HYBRID_OBJECT_TEST_TIMEOUT)
        )
          .didNotThrow()
          .equals(true)
    ),
    createTest('promiseThatResolvesVoidInstantly() works', async () =>
      (await it(() => testObject.promiseThatResolvesVoidInstantly()))
        .didNotThrow()
        .didReturn('undefined')
    ),
    createTest('promiseThatResolvesToUndefined() works', async () =>
      (await it(() => testObject.promiseThatResolvesToUndefined()))
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('awaitNullablePromise() works', async () =>
      (await it(() => testObject.awaitNullablePromise()))
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('twoPromises can run in parallel', async () =>
      (
        await it(async () => {
          const start = performance.now()
          // 0.5s + 0.5s = ~1s in serial, ~0.5s in parallel
          await Promise.all([testObject.wait(0.5), testObject.wait(0.5)])
          const end = performance.now()
          const didRunInParallel = end - start < 1000
          return didRunInParallel
        })
      )
        .didNotThrow()
        .equals(true)
    ),
    createTest('JS Promise<number> can be awaited on native side', async () =>
      (
        await it(async () => {
          let resolve = (_: number) => {}
          const promise = new Promise<number>((r) => {
            resolve = r
          })
          const nativePromise = testObject.awaitAndGetPromise(promise)
          resolve(5)
          return await nativePromise
        })
      )
        .didNotThrow()
        .equals(5)
    ),
    createTest('JS Promise<Car> can be awaited on native side', async () =>
      (
        await it(async () => {
          let resolve = (_: Car) => {}
          const promise = new Promise<Car>((r) => {
            resolve = r
          })
          const nativePromise = testObject.awaitAndGetComplexPromise(promise)
          resolve(TEST_CAR)
          return await nativePromise
        })
      )
        .didNotThrow()
        .equals(TEST_CAR)
    ),
    createTest('JS Promise<void> can be awaited on native side', async () =>
      (
        await it(async () => {
          let resolve = () => {}
          const promise = new Promise<void>((r) => {
            resolve = r
          })
          const nativePromise = testObject.awaitPromise(promise)
          resolve()
          return await nativePromise
        })
      )
        .didNotThrow()
        .equals(undefined)
    ),
    createTest(
      'JS Promise<void> that rejects will also reject on native',
      async () =>
        (
          await it(async () => {
            let reject = (_: Error) => {}
            const promise = new Promise<void>((_, r) => {
              reject = r
            })
            const nativePromise = testObject.awaitPromise(promise)
            reject(new Error(`rejected from JS!`))
            return await nativePromise
          })
        ).didThrow()
    ),

    // Callbacks
    createTest('callCallback(...)', async () =>
      (
        await it<boolean>(async () => {
          return new Promise((resolve) => {
            testObject.callCallback(() => {
              resolve(true)
            })
          })
        })
      )
        .didNotThrow()
        .equals(true)
    ),
    createTest('createNativeCallback(...) test native GC', () =>
      it(() => {
        // This deletes and allocates 10k native callbacks -
        // effectively this tests if GC works for callbacks that
        // are bound to native functions.
        lotsOfCallbacks = []
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let someNumberWeWillCapture = 0
        for (let i = 0; i < 10_000; i++) {
          const cb = testObject.createNativeCallback((num) => {
            someNumberWeWillCapture += num
          })
          lotsOfCallbacks.push(cb)
        }
        gc()
        return lotsOfCallbacks.length
      })
        .didNotThrow()
        .equals(10_000)
    ),
    createTest(
      'HybridObjects do not leak memory when automatically reclaimed by JS GC',
      () =>
        it(() => {
          const baselineAllocations =
            NitroModules.debug_getTotalAllocatedHybridObjects()
          const BATCH_SIZE = 1000

          const objects: Array<TestObjectCpp | TestObjectSwiftKotlin> = []
          for (let i = 0; i < MEMORY_LEAK_TEST_ALLOCATION_COUNT; i++) {
            const object = testObject.newTestObject()
            object.numberValue = i
            objects.push(object)

            if (objects.length >= BATCH_SIZE) {
              objects.length = 0
              gc()
            }
          }

          objects.length = 0
          gc()
          gc()
          gc()

          const currentAllocations =
            NitroModules.debug_getTotalAllocatedHybridObjects()
          const remainingAllocations = currentAllocations - baselineAllocations
          // make sure that less than 10% of the total allocations are remaining, indicating GC ran for most of it.
          const didDeleteMostObjects =
            remainingAllocations < MEMORY_LEAK_TEST_ALLOCATION_COUNT * 0.1
          const result: {
            baselineAllocations: number
            currentAllocations: number
            isEqual?: boolean
          } = {
            baselineAllocations: baselineAllocations,
            currentAllocations: currentAllocations,
            isEqual: didDeleteMostObjects,
          }
          if (!didDeleteMostObjects) {
            delete result.isEqual
          }
          return result
        })
          .didNotThrow()
          .toContain('isEqual')
    ),
    createTest('HybridObjects dont leak memory with manual dispose()', () =>
      it(() => {
        const BATCH_SIZE = 1000

        for (let i = 0; i < MEMORY_LEAK_TEST_ALLOCATION_COUNT; i++) {
          const object = testObject.newTestObject()
          object.dispose()

          if ((i + 1) % BATCH_SIZE === 0) {
            gc()
          }
        }

        gc()
      }).didNotThrow()
    ),
    createTest('callWithOptional(undefined)', async () =>
      (
        await it<number | undefined>(() => {
          return new Promise((resolve) => {
            testObject.callWithOptional(undefined, (val) => {
              resolve(val)
            })
          })
        })
      )
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('callWithOptional(433)', async () =>
      (
        await it<number | undefined>(() => {
          return new Promise((resolve) => {
            testObject.callWithOptional(433, (val) => {
              resolve(val)
            })
          })
        })
      )
        .didNotThrow()
        .equals(433)
    ),
    createTest('getValueFromJsCallback(...)', async () =>
      (
        await it(async () => {
          let value: string | undefined
          await testObject.getValueFromJsCallback(
            () => 'hello',
            (val) => {
              value = val
            }
          )
          return value
        })
      )
        .didNotThrow()
        .equals('hello')
    ),
    createTest('callCallbackThatReturnsPromiseVoid(...)', async () =>
      (
        await it(() =>
          testObject.callCallbackThatReturnsPromiseVoid(() => Promise.resolve())
        )
      )
        .didNotThrow()
        .didReturn('undefined')
    ),
    createTest(
      'Single callback can be called and awaited: getValueFromJSCallbackAndWait(...)',
      async () =>
        (await it(() => testObject.getValueFromJSCallbackAndWait(() => 73)))
          .didNotThrow()
          .equals(73)
    ),
    createTest('Multiple callbacks are all called: callAll(...)', async () =>
      (
        await it(() => {
          return new Promise((resolve) => {
            let calledCount = 0
            const func = () => {
              calledCount++
              if (calledCount === 3) resolve(calledCount)
            }
            testObject.callAll(func, func, func)
          })
        })
      )
        .didNotThrow()
        .equals(3)
    ),
    createTest(
      'Callback can be called multiple times: callSumUpNTimes(...)',
      async () =>
        (await it(async () => await testObject.callSumUpNTimes(() => 7, 5)))
          .didNotThrow()
          .equals(7 * 5 /* = 35 */)
    ),
    createTest(
      'Async callback can be awaited and returned on native side: callbackAsyncPromise(...)',
      async () =>
        (
          await it(async () => {
            const result = await testObject.callbackAsyncPromise(async () => {
              return 13
            })
            return result
          })
        )
          .didNotThrow()
          .equals(13)
    ),
    createTest(
      'Async callback can be awaited and returned on native side: callbackAsyncPromiseBuffer(...)',
      async () =>
        (
          await it(async () => {
            const result = await testObject.callbackAsyncPromiseBuffer(
              async () => {
                return await testObject.createArrayBufferAsync()
              }
            )
            return result
          })
        )
          .didNotThrow()
          .didReturn('object')
          .toContain('byteLength')
    ),
    createTest(
      'Async callback that throws in JS will rethrow in native',
      async () =>
        (
          await it(async () => {
            await testObject.callbackAsyncPromise(() => {
              throw new Error(`throwing in JS!`)
            })
          })
        ).didThrow()
    ),
    createTest('Getting complex callback from native returns a function', () =>
      it(() => testObject.getComplexCallback())
        .didNotThrow()
        .didReturn('function')
    ),
    createTest(
      'Calling twoOptionalCallbacks(...) works with callbacks',
      async () =>
        (
          await it(async () => {
            return new Promise((resolve) => {
              let counter = 0
              const onWasCalled = () => {
                counter++
                if (counter === 2) resolve(counter)
              }
              testObject.twoOptionalCallbacks(
                55,
                () => onWasCalled(),
                () => onWasCalled()
              )
            })
          })
        )
          .didNotThrow()
          .equals(2)
    ),
    createTest('Calling twoOptionalCallbacks(...) works with undefined', () =>
      it(() => testObject.twoOptionalCallbacks(55)).didNotThrow()
    ),
    createTest('Calling errorCallback(...) works with error', async () =>
      (
        await it(async () => {
          return new Promise((resolve) => {
            testObject.errorCallback((err) => resolve(err))
          })
        })
      )
        .didNotThrow()
        .isInstanceOf(Error)
    ),

    // Objects
    createTest('getCar()', () =>
      it(() => testObject.getCar())
        .didNotThrow()
        .didReturn('object')
        .toContain('year')
        .toContain('make')
        .toContain('model')
        .toContain('power')
        .toContain('powertrain')
        .toContain('driver')
        .toContain('favouriteTrack')
        .toContain('someVariant')
    ),
    createTest('isCarElectric(...)', () =>
      it(() =>
        testObject.isCarElectric({
          make: 'Lamborghini',
          year: 2018,
          model: 'Huracan Performante',
          power: 640,
          passengers: [],
          powertrain: 'gas',
          isFast: true,
          performanceScores: [100, 0],
        })
      )
        .didNotThrow()
        .equals(false)
    ),
    createTest('areCarsEqual(...) same car', () =>
      it(() => testObject.areCarsEqual(TEST_CAR, TEST_CAR))
        .didNotThrow()
        .equals(true)
    ),
    createTest('areCarsEqual(...) different cars', () =>
      it(() => testObject.areCarsEqual(TEST_CAR, TEST_CAR_2))
        .didNotThrow()
        .equals(false)
    ),
    createTest('getDriver(...) with no driver', () =>
      it(() =>
        testObject.getDriver({
          make: 'Lamborghini',
          year: 2018,
          model: 'Huracan Performante',
          power: 640,
          passengers: [],
          powertrain: 'gas',
          isFast: true,
          performanceScores: [100, 0],
        })
      )
        .didNotThrow()
        .equals(undefined)
    ),
    createTest('getDriver(...) with driver', () =>
      it(() =>
        testObject.getDriver({
          make: 'Lamborghini',
          year: 2018,
          model: 'Huracan Performante',
          power: 640,
          passengers: [],
          powertrain: 'gas',
          driver: { age: 24, name: 'marc' },
          isFast: true,
          performanceScores: [100, 0],
        })
      )
        .didNotThrow()
        .equals({ age: 24, name: 'marc' })
    ),
    createTest('bounceCar(...) TEST_CAR_1', () =>
      it(() => testObject.bounceCar(TEST_CAR))
        .didNotThrow()
        .equals(TEST_CAR)
    ),
    createTest('bounceCar(...) TEST_CAR_2', () =>
      it(() => testObject.bounceCar(TEST_CAR_2))
        .didNotThrow()
        .equals(TEST_CAR_2)
    ),
    createTest('jsStyleObjectAsParameters()', async () =>
      (
        await it(() => {
          return new Promise((resolve) => {
            testObject.jsStyleObjectAsParameters({
              value: 55,
              onChanged: (num) => resolve(num),
            })
          })
        })
      )
        .didNotThrow()
        .didReturn('number')
        .equals(55)
    ),

    // Hybrid Object Tests
    createTest('get self', () =>
      it(() => testObject.thisObject)
        .didNotThrow()
        .didReturn('object')
        .toContain('int64Value')
        .toContain('uint64Value')
        .toContain('boolValue')
        .toContain('stringValue')
    ),
    createTest('newTestObject()', () =>
      it(() => testObject.newTestObject())
        .didNotThrow()
        .didReturn('object')
        .toContain('int64Value')
        .toContain('uint64Value')
        .toContain('boolValue')
        .toContain('stringValue')
    ),

    // ArrayBuffers
    createTest('createArrayBuffer()', () =>
      it(() => testObject.createArrayBuffer())
        .didNotThrow()
        .didReturn('object')
    ),
    createTest('createArrayBufferFromNativeBuffer(copy)', () =>
      it(() => testObject.createArrayBufferFromNativeBuffer(true))
        .didNotThrow()
        .didReturn('object')
    ),
    createTest('createArrayBufferFromNativeBuffer(wrap)', () =>
      it(() => testObject.createArrayBufferFromNativeBuffer(false))
        .didNotThrow()
        .didReturn('object')
    ),
    createTest('getBufferLastItem(...) == 5', () =>
      it(() => {
        const buffer = new Uint8Array([13, 20, 55])
        return testObject.getBufferLastItem(buffer.buffer)
      })
        .didNotThrow()
        .equals(55)
    ),
    createTest('setAllValuesTo(...)', () =>
      it(() => {
        const buffer = new Uint8Array(30)
        testObject.setAllValuesTo(buffer.buffer, 55)
        return buffer.every((v) => v === 55)
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('createArrayBufferAsync()', async () =>
      (await it(() => testObject.createArrayBufferAsync()))
        .didNotThrow()
        .didReturn('object')
    ),
    ...[
      { name: 'JS', create: () => new ArrayBuffer(1024) },
      {
        name: 'native allocation',
        create: () => testObject.createArrayBuffer(),
      },
      {
        name: 'native buffer',
        create: () => testObject.createArrayBufferFromNativeBuffer(false),
      },
    ].flatMap(({ name, create }) => [
      createTest(
        `copyBuffer(${name}) copies bytes into independent memory`,
        () =>
          it(() => {
            const original = create()
            const originalArray = new Uint8Array(original)
            originalArray.fill(17)
            originalArray[0] = 0
            originalArray[73] = 255
            const last = originalArray.length - 1
            const indices = [0, 73, Math.floor(originalArray.length / 2), last]
            originalArray[last] = 42

            const copy = testObject.copyBuffer(original)
            const copyArray = new Uint8Array(copy)
            const copiedBytes =
              copy.byteLength === original.byteLength &&
              indices.every(
                (index) => copyArray[index] === originalArray[index]
              )

            // JS writes to either buffer must leave the other buffer unchanged.
            originalArray[73] = 11
            originalArray[last] = 12
            const copyAfterOriginalWrite = [
              copyArray[73],
              testObject.getBufferLastItem(copy),
            ]
            copyArray[73] = 21
            copyArray[last] = 22
            const originalAfterCopyWrite = [
              originalArray[73],
              testObject.getBufferLastItem(original),
            ]

            // Native writes must also stay within the chosen allocation.
            testObject.setAllValuesTo(original, 31)
            const copyAfterNativeOriginalWrite = [
              copyArray[73],
              testObject.getBufferLastItem(copy),
            ]
            testObject.setAllValuesTo(copy, 41)
            return {
              copiedBytes,
              copyAfterOriginalWrite,
              originalAfterCopyWrite,
              copyAfterNativeOriginalWrite,
              originalUnchanged: indices.every(
                (index) => originalArray[index] === 31
              ),
              copyUpdated: indices.every((index) => copyArray[index] === 41),
            }
          })
            .didNotThrow()
            .equals({
              copiedBytes: true,
              copyAfterOriginalWrite: [255, 42],
              originalAfterCopyWrite: [11, 12],
              copyAfterNativeOriginalWrite: [21, 22],
              originalUnchanged: true,
              copyUpdated: true,
            })
      ),
      createTest(
        `bounceArrayBuffer(${name}) shares memory across roundtrips`,
        () =>
          it(() => {
            const original = create()
            const originalArray = new Uint8Array(original)
            originalArray.fill(17)
            originalArray[0] = 0
            originalArray[73] = 255
            const last = originalArray.length - 1
            const indices = [0, 73, Math.floor(originalArray.length / 2), last]
            originalArray[last] = 42

            const bounced = testObject.bounceArrayBuffer(original)
            const bouncedAgain = testObject.bounceArrayBuffer(bounced)
            const bouncedArray = new Uint8Array(bounced)
            const bouncedAgainArray = new Uint8Array(bouncedAgain)
            const preservedBytes = [bouncedArray, bouncedAgainArray].every(
              (array) =>
                array.length === originalArray.length &&
                indices.every((index) => array[index] === originalArray[index])
            )

            // Mutating the original must reach both aliases and native readers.
            originalArray[73] = 11
            originalArray[last] = 12
            const aliasesAfterOriginalWrite = [
              bouncedArray[73],
              testObject.getBufferLastItem(bounced),
              bouncedAgainArray[73],
              testObject.getBufferLastItem(bouncedAgain),
            ]

            // Mutating the latest alias must reach the original and earlier alias.
            bouncedAgainArray[73] = 21
            bouncedAgainArray[last] = 22
            const buffersAfterAliasWrite = [
              originalArray[73],
              testObject.getBufferLastItem(original),
              bouncedArray[73],
              testObject.getBufferLastItem(bounced),
            ]

            testObject.setAllValuesTo(bounced, 31)
            return {
              preservedBytes,
              aliasesAfterOriginalWrite,
              buffersAfterAliasWrite,
              nativeWriteShared:
                indices.every((index) => originalArray[index] === 31) &&
                indices.every((index) => bouncedAgainArray[index] === 31),
            }
          })
            .didNotThrow()
            .equals({
              preservedBytes: true,
              aliasesAfterOriginalWrite: [11, 12, 11, 12],
              buffersAfterAliasWrite: [21, 22, 21, 22],
              nativeWriteShared: true,
            })
      ),
    ]),
    createTest('bounceArrayBuffer(js buffer) strict equals', async () =>
      it(() => {
        // 1. Create js buffer where value[73] is 4
        const originalArray = new Uint8Array(100)
        originalArray[73] = 4
        // 2. Do JS -> native -> JS roundtrip
        const bouncedBuffer = testObject.bounceArrayBuffer(originalArray.buffer)
        const bouncedArray = new Uint8Array(bouncedBuffer)
        // 3. Compare if the value at [73] is still equal
        return bouncedArray.buffer === originalArray.buffer
      })
        .didNotThrow()
        .equals(true)
    ),

    // HardwareBuffers
    ...HARDWARE_BUFFER_FORMATS.map(({ format, bytesPerPixel }) =>
      createTest(`createHardwareBuffer(${format}) size is in bytes`, () =>
        it(() => {
          const buffer = testObject.createHardwareBuffer(100, 100, 1, format)
          // On Android the row stride may be padded, so the size can be larger -
          // but if the size was computed in pixels instead of bytes, it'd be smaller.
          return buffer.byteLength >= 100 * 100 * bytesPerPixel
        })
          .didNotThrow()
          .equals(true)
      )
    ),
    createTest('createHardwareBuffer(blob) size is exactly `width` bytes', () =>
      it(() => {
        // BLOB HardwareBuffers hold exactly `width` bytes flat.
        const buffer = testObject.createHardwareBuffer(12345, 1, 1, 'blob')
        return buffer.byteLength
      })
        .didNotThrow()
        .equals(12345)
    ),
    createTest('copyBuffer(createHardwareBuffer(..)) keeps size and data', () =>
      it(() => {
        const original = testObject.createHardwareBuffer(
          100,
          100,
          1,
          'rgba-8888'
        )
        const originalArray = new Uint8Array(original)
        originalArray[originalArray.length - 1] = 42
        const copy = testObject.copyBuffer(original)
        const copyArray = new Uint8Array(copy)
        return (
          copy.byteLength === original.byteLength &&
          copyArray[copyArray.length - 1] === 42
        )
      })
        .didNotThrow()
        .equals(true)
    ),

    // Base HybridObject inherited methods
    createTest('.toString()', () =>
      it(() => testObject.toString())
        .didNotThrow()
        .didReturn('string')
        .equals(`[HybridObject ${testObject.name}]`)
    ),
    createTest('.name', () =>
      it(() => testObject.name)
        .didNotThrow()
        .didReturn('string')
    ),
    createTest('.equals(...) == true', () =>
      it(() => testObject.equals(testObject))
        .didNotThrow()
        .equals(true)
    ),
    createTest('.equals(.self) == true', () =>
      it(() => testObject.equals(testObject.thisObject))
        .didNotThrow()
        .equals(true)
    ),
    createTest('.self == .self', () =>
      // eslint-disable-next-line no-self-compare
      it(() => testObject.thisObject === testObject.thisObject)
        .didNotThrow()
        .equals(true)
    ),
    createTest('.equals(newTestObject()) == false', () =>
      it(() => testObject.equals(testObject.newTestObject()))
        .didNotThrow()
        .equals(false)
    ),
    createTest('Object.keys(...)', () =>
      it(() => Object.keys(testObject))
        .didNotThrow()
        .didReturn('object')
        .toBeArray()
    ),
    ...('rawJsiFunc' in testObject
      ? [
          createTest('Call Raw JSI Func', () =>
            // @ts-expect-error
            it(() => testObject.rawJsiFunc(55, false, 'hello', { obj: true }))
              .didNotThrow()
              .equals([55, false, 'hello', { obj: true }])
          ),
        ]
      : [
          // Swift/Kotlin Test Objects don't have raw JSI functions!
        ]),

    createTest('createBase() works', () =>
      it(() => testObject.createBase())
        .didNotThrow()
        .didReturn('object')
        .toContain('baseValue')
    ),
    createTest('createChild() works', () =>
      it(() => testObject.createChild())
        .didNotThrow()
        .didReturn('object')
        .toContain('childValue')
        .toContain('baseValue')
    ),
    createTest('createBase() has name "Base"', () =>
      it(() => testObject.createBase().name)
        .didNotThrow()
        .equals('Base')
    ),
    createTest('createChild() has name "Child"', () =>
      it(() => testObject.createChild().name)
        .didNotThrow()
        .equals('Child')
    ),
    createTest('createChild() has overridden toString()', () =>
      it(() => testObject.createChild().toString())
        .didNotThrow()
        .equals('HybridChild custom toString() :)')
    ),
    createTest('createBaseActualChild() has overridden toString()', () =>
      it(() => testObject.createBaseActualChild().toString())
        .didNotThrow()
        .equals('HybridChild custom toString() :)')
    ),
    createTest('createBaseActualChild() has name "Child"', () =>
      it(() => testObject.createBaseActualChild().name)
        .didNotThrow()
        .equals('Child')
    ),
    createTest('createBaseActualChild() works', () =>
      it(() => testObject.createBaseActualChild())
        .didNotThrow()
        .didReturn('object')
        .toContain('baseValue')
    ),
    createTest('createBaseActualChild() is actually a child', () =>
      it(() => testObject.createBaseActualChild())
        .didNotThrow()
        .didReturn('object')
        // @ts-expect-error
        .toContain('childValue')
        .toContain('baseValue')
    ),
    createTest('bounceChild(Child) ===', () =>
      it(() => {
        const child = testObject.createChild()
        const bounced = testObject.bounceChild(child)
        return bounced === child
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('bounceBase(Base) ===', () =>
      it(() => {
        const base = testObject.createBase()
        const bounced = testObject.bounceBase(base)
        return bounced === base
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('bounceBase(Child) ===', () =>
      it(() => {
        const child = testObject.createChild()
        const bounced = testObject.bounceBase(child)
        return bounced === child
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('bounceChild(Base) throws', () =>
      it(() => {
        if (NitroModules.buildType === 'debug') {
          const child = testObject.createBase()
          // @ts-expect-error
          testObject.bounceChild(child)
        } else {
          // This only throws in __DEV__ - in release it is optimized away and would crash. :)
          throw new Error(
            `This only throws in __DEV__ - in release it is optimized away and would crash. :)`
          )
        }
      }).didThrow()
    ),
    createTest('bounceChildBase(Child) ===', () =>
      it(() => {
        const child = testObject.createChild()
        const bounced = testObject.bounceChildBase(child)
        return bounced === child
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('castBase(Child) works', () =>
      it(() => {
        const child = testObject.createChild()
        const bounced = testObject.castBase(child)
        return bounced === child
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('callbackSync(() => number) returns same number', () =>
      it(() => {
        return testObject.callbackSync(() => 55)
      })
        .didNotThrow()
        .equals(55)
    ),
    createTest('getSyncNumberCallback()() returns a number', () =>
      it(() => {
        const callback = testObject.getSyncNumberCallback()
        return callback()
      })
        .didNotThrow()
        .equals(55)
    ),
    ...[-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n].map((value) =>
      createTest(`Int64 callback roundtrip preserves ${value}`, () =>
        it(() => {
          const callback = testObject.bounceSyncInt64Callback((input) => input)
          return callback(value)
        })
          .didNotThrow()
          .equals(value)
      )
    ),
    createTest(
      'native void callback invokes its wrapped JS callback',
      async () =>
        (
          await it(
            () =>
              new Promise<number>((resolve) => {
                const callback = testObject.createNativeCallback(resolve)
                callback(55)
              })
          )
        )
          .didNotThrow()
          .equals(55)
    ),
    createTest('bounceExternalHybrid(...) works', () =>
      it(() => {
        return testObject.bounceExternalHybrid(HybridSomeExternalObject)
      })
        .didNotThrow()
        .equals(HybridSomeExternalObject)
    ),
    createTest('bounceExternalStruct(...) works', () =>
      it(() => {
        return testObject.bounceExternalStruct({
          someExternal: HybridSomeExternalObject,
        })
      })
        .didNotThrow()
        .equals({ someExternal: HybridSomeExternalObject })
    ),
    createTest('bounceExternalVariant(...) works with string', () =>
      it(() => {
        return testObject.bounceExternalVariant('Hello!')
      })
        .didNotThrow()
        .didReturn('string')
        .equals('Hello!')
    ),
    createTest('bounceExternalVariant(...) works with external object', () =>
      it(() => {
        return testObject.bounceExternalVariant(HybridSomeExternalObject)
      })
        .didNotThrow()
        .didReturn('object')
        .equals(HybridSomeExternalObject)
    ),
    createTest('createExternalVariantFromFunc(...) works', () =>
      it(() => {
        const factory = () => HybridSomeExternalObject
        return testObject.createExternalVariantFromFunc(factory)
      })
        .didNotThrow()
        .didReturn('object')
        .equals(HybridSomeExternalObject)
    ),
    createTest('createInternalObject(...) returns a different subclass', () =>
      it(() => {
        const object = testObject.createInternalObject()
        return object.getValue()
      })
        .didNotThrow()
        .equals('This is overridden!')
    ),
    createTest('new T() works', () =>
      it(() => {
        const HybridTestObjectCpp =
          getHybridObjectConstructor<TestObjectCpp>('TestObjectCpp')
        const instance = new HybridTestObjectCpp()
        return instance
      })
        .didNotThrow()
        .toContain('boolValue')
    ),
    createTest('new T() instanceof works', () =>
      it(() => {
        const HybridTestObjectCpp =
          getHybridObjectConstructor<TestObjectCpp>('TestObjectCpp')
        const instance = new HybridTestObjectCpp()
        return instance instanceof HybridTestObjectCpp
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('{} instanceof works', () =>
      it(() => {
        const HybridTestObjectCpp =
          getHybridObjectConstructor<TestObjectCpp>('TestObjectCpp')
        return {} instanceof HybridTestObjectCpp
      })
        .didNotThrow()
        .equals(false)
    ),
    createTest('new T() =/= new T()', () =>
      it(() => {
        const HybridTestObjectCpp =
          getHybridObjectConstructor<TestObjectCpp>('TestObjectCpp')
        const a = new HybridTestObjectCpp()
        const b = new HybridTestObjectCpp()
        return a === b
      })
        .didNotThrow()
        .equals(false)
    ),
    createTest('new T() a == a', () =>
      it(() => {
        const HybridTestObjectCpp =
          getHybridObjectConstructor<TestObjectCpp>('TestObjectCpp')
        const a = new HybridTestObjectCpp()
        // eslint-disable-next-line no-self-compare
        return a === a
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('testObject.dispose() works and calls callback', async () =>
      (
        await it(() => {
          return new Promise((resolve) => {
            const hybridObject = testObject.newTestObject()
            hybridObject.optionalCallback = () => {
              resolve(true)
            }
            // dispose() will call this.optionalCallback() one last time then the object is gone
            hybridObject.dispose()
          })
        })
      )
        .didNotThrow()
        .equals(true)
    ),
    createTest('PlatformObject getOSVersion() returns a string', () =>
      it(() => HybridPlatformObject.getOSVersion())
        .didNotThrow()
        .didReturn('string')
    ),
    createTest(
      'NitroModules.updateMemorySize(obj) updates external memory pressure',
      () =>
        it(() => {
          const originalString = testObject.stringValue

          try {
            testObject.stringValue = ''
            NitroModules.updateMemorySize(testObject)

            testObject.stringValue = 'x'.repeat(EXTERNAL_MEMORY_TEST_SIZE)
            const externalBytesBefore = getHermesExternalMemorySize()
            NitroModules.updateMemorySize(testObject)
            const externalBytesAfter = getHermesExternalMemorySize()

            return externalBytesAfter - externalBytesBefore
          } finally {
            testObject.stringValue = originalString
            NitroModules.updateMemorySize(testObject)
          }
        })
          .didNotThrow()
          .didReturn('number')
          .equals(EXTERNAL_MEMORY_TEST_SIZE)
    ),
    createTest('NitroModules.createNativeArrayBuffer(...) works', () =>
      it(() => {
        const buffer = NitroModules.createNativeArrayBuffer(1024)
        const array = new Uint8Array(buffer)
        array[0] = 13
        return array[0]
      })
        .didNotThrow()
        .didReturn('number')
        .equals(13)
    ),
    createTest(
      'NitroModules.createNativeArrayBuffer(...) reports external memory pressure',
      () =>
        it(() => {
          const size = EXTERNAL_MEMORY_TEST_SIZE
          const externalBytesBefore = getHermesExternalMemorySize()
          const buffer = NitroModules.createNativeArrayBuffer(size)
          const externalBytesAfter = getHermesExternalMemorySize()

          if (buffer.byteLength !== size) {
            throw new Error(
              `Expected a ${size}-byte ArrayBuffer, but received ${buffer.byteLength} bytes!`
            )
          }

          return externalBytesAfter - externalBytesBefore
        })
          .didNotThrow()
          .didReturn('number')
          .equals(EXTERNAL_MEMORY_TEST_SIZE)
    ),
    createTest('NitroModules.buildType holds a string', () =>
      it(() => {
        return NitroModules.buildType
      })
        .didNotThrow()
        .didReturn('string')
    ),
    createTest('NitroModules.version holds a string', () =>
      it(() => {
        return NitroModules.version
      })
        .didNotThrow()
        .didReturn('string')
    ),
    createTest('NitroModules.getAllHybridObjectNames() returns an array', () =>
      it(() => {
        return NitroModules.getAllHybridObjectNames()
      })
        .didNotThrow()
        .toBeArray()
    ),
    createTest('NitroModules.box(testObject) returns an object', () =>
      it(() => {
        return NitroModules.box(testObject)
      })
        .didNotThrow()
        .didReturn('object')
    ),
    createTest(
      'NitroModules.box(testObject).unbox() returns the same object',
      () =>
        it(() => {
          const boxed = NitroModules.box(testObject)
          const original = boxed.unbox()
          return original === testObject
        })
          .didNotThrow()
          .equals(true)
    ),
    createTest('NitroModules.hasHybridObject(testObject.name) to be true', () =>
      it(() => {
        return NitroModules.hasHybridObject(testObject.name)
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('NitroModules.isHybridObject(testObject) to be true', () =>
      it(() => {
        return NitroModules.isHybridObject(testObject)
      })
        .didNotThrow()
        .equals(true)
    ),
    createTest('NitroModules.hasNativeState(testObject) to be true', () =>
      it(() => {
        return NitroModules.hasNativeState(testObject)
      })
        .didNotThrow()
        .equals(true)
    ),
  ]
}
