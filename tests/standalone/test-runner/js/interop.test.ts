import { expect } from 'chai'
import { namedCases, casesForSharedSpecializations, casesForTestObjects, recordCallback, rejection, waitFor } from './utils/cases'
import { NitroModules } from 'nitro-core'
import {
  Base,
  Child,
  type Powertrain,
  TestObjectCpp,
  TestObjectSwiftKotlin,
  PlatformObject,
  SizeUnit,
  type Size,
  CppBase,
  CppChild,
  CppGrandchild,
  Grandchild,
} from 'nitro-test'
import { HybridSomeExternalObject, isKotlin, isSwift } from './utils/testObjects'
import { TEST_CUSTOM_TYPE, TEST_PERSON, TEST_CAR } from './utils/fixtures'
import { debugOnly } from './utils/helpers'
import {
  Base as ExternalBase,
  CppOnlyValueKind,
  SizeUnit as ExternalSizeUnit,
  type Size as ExternalSize,
  SomeExternalObject,
} from 'nitro-test-external'

// `rawJsiFunc` is registered as a raw JSI method in `HybridTestObjectCpp.hpp`,
// so it is not part of the `TestObjectCpp` spec.
interface WithRawJsiFunc {
  rawJsiFunc(...args: unknown[]): unknown
}

const POWERTRAINS: Powertrain[] = ['electric', 'gas', 'hybrid']

const INT64_MIN = -(2n ** 63n)

const INT64_MAX = 2n ** 63n - 1n

const UINT64_MAX = 2n ** 64n - 1n

const LOCAL_SIZE: Size = {
  width: 640,
  height: 480,
  unit: SizeUnit.Pixels,
}

const EXTERNAL_SIZE: ExternalSize = {
  width: 1920,
  height: 1080,
  unit: ExternalSizeUnit.Pixels,
  scale: 2,
}

const CALLBACK_TIMEOUT = { timeout: 2000 }

const SIZE: Size = { width: 640, height: 480, unit: SizeUnit.Pixels }

export const cases = {
  ...namedCases('C++ only / TestObjectCpp', {
    'getVariantTuple(...) converts Float2': () => {
      const testObject = new TestObjectCpp()

      expect(testObject.getVariantTuple([10, 20])).to.deep.equal([10, 20])
    },

    'getVariantTuple(...) converts Float3': () => {
      const testObject = new TestObjectCpp()

      expect(testObject.getVariantTuple([10, 20, 30])).to.deep.equal([10, 20, 30])
    },

    'getVariantTuple(...) throws at wrong size (5 items)': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple([10, 20, 30, 40, 50])
      ).to.throw(`${testObject.constructor.name}.getVariantTuple(...): Cannot convert`)
    },

    'getVariantTuple(...) throws at wrong type (string)': () => {
      const testObject = new TestObjectCpp()

      // @ts-expect-error
      expect(() => testObject.getVariantTuple('hello')).to.throw(`${testObject.constructor.name}.getVariantTuple(...): Cannot convert`)
    },

    'getVariantTuple(...) throws at wrong type (string[])': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple(['hello', 'world'])
      ).to.throw(`${testObject.constructor.name}.getVariantTuple(...): Cannot convert`)
    },

    "someTuple roundtrips [55, 'hello']": () => {
      const testObject = new TestObjectCpp()

      testObject.someTuple = [55, 'hello']
      expect(testObject.someTuple).to.deep.equal([55, 'hello'])
    },

    'flip([10, 20, 30]) reverses the tuple': () => {
      const testObject = new TestObjectCpp()

      expect(testObject.flip([10, 20, 30])).to.deep.equal([30, 20, 10])
    },

    'flip([10, 20]) throws at wrong size': () => {
      const testObject = new TestObjectCpp()

      const flipTwoItems = () =>
        testObject.flip(
          // @ts-expect-error
          [10, 20]
        )
      expect(flipTwoItems).to.throw(
        `${testObject.constructor.name}.flip(...): The given JS Array has 2 items, but ${debugOnly('std::tuple<double, double, double>')}`
      )
      expect(flipTwoItems).to.throw('expects 3 items')
    },

    'passTuple(...) returns the same tuple': () => {
      const testObject = new TestObjectCpp()

      expect(testObject.passTuple([13, 'hello', true])).to.deep.equal([13, 'hello', true])
    },

    'bounceCustomType(...) returns the same value': () => {
      const testObject = new TestObjectCpp()

      expect(Object.is(testObject.bounceCustomType(TEST_CUSTOM_TYPE), TEST_CUSTOM_TYPE)).to.equal(true)
    },

    'bounceAnyHybrid(...) returns the same object': () => {
      const testObject = new TestObjectCpp()

      expect(Object.is(testObject.bounceAnyHybrid(HybridSomeExternalObject), HybridSomeExternalObject)).to.equal(true)
    },

    'bounceAnyHybrid(...) result does not equal a different object': () => {
      const testObject = new TestObjectCpp()

      const external = testObject.bounceAnyHybrid(HybridSomeExternalObject)
      expect(Object.is(external.equals(testObject), false)).to.equal(true)
    },

    'rawJsiFunc(...) returns its arguments as an array': () => {
      const testObject = new TestObjectCpp()

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc

      const result = rawObject.rawJsiFunc(55, false, 'hello', { obj: true })
      expect(result).to.deep.equal([55, false, 'hello', { obj: true }])
    },

    'getVariantHybridEnum(...) bounces a HybridObject': () => {
      const testObject = new TestObjectCpp()

      expect(Object.is(testObject.getVariantHybridEnum(testObject), testObject)).to.equal(true)
    },

    'getVariantHybridEnum(...) bounces every Powertrain': () => {
      const testObject = new TestObjectCpp()

      for (const powertrain of POWERTRAINS) {
        expect(Object.is(testObject.getVariantHybridEnum(powertrain), powertrain), powertrain).to.equal(true)
      }
    },

    'getVariantHybridEnum(...) throws for an unknown string': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum('diesel')
      ).to.throw(
        `${testObject.constructor.name}.getVariantHybridEnum(...): Cannot convert "diesel" to any type in ${debugOnly('variant<std::shared_ptr<margelo::nitro::test::HybridTestObjectCppSpec>, margelo::nitro::test::Powertrain>!')}`
      )
    },

    'getVariantHybridEnum(...) throws for a TestObjectSwiftKotlin': () => {
      const testObject = new TestObjectCpp()

      const swiftKotlinObject = new TestObjectSwiftKotlin()

      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum(swiftKotlinObject)
      ).to.throw(`${testObject.constructor.name}.getVariantHybridEnum(...): Cannot convert "${String(swiftKotlinObject)}" to any type in `)
    },

    'getVariantHybridEnum(...) throws for a Person': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum(TEST_PERSON)
      ).to.throw(`${testObject.constructor.name}.getVariantHybridEnum(...): Cannot convert "[object Object]" to any type in `)
    },

    'getVariantTuple(...) checks every item, not just the first': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        testObject.getVariantTuple(
          // @ts-expect-error
          [10, 'twenty']
        )
      ).to.throw(`${testObject.constructor.name}.getVariantTuple(...): Cannot convert "10,twenty" to any type in `)
    },

    'getVariantTuple(...) throws for an empty array': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple([])
      ).to.throw(`${testObject.constructor.name}.getVariantTuple(...): Cannot convert "" to any type in `)
    },

    'getVariantTuple(...) keeps NaN and Infinity': () => {
      const testObject = new TestObjectCpp()

      expect(testObject.getVariantTuple([NaN, Infinity])).to.deep.equal([NaN, Infinity])
    },

    'someTuple roundtrips NaN and an empty string': () => {
      const testObject = new TestObjectCpp()

      testObject.someTuple = [NaN, '']
      expect(testObject.someTuple).to.deep.equal([NaN, ''])
    },

    'someTuple throws for 1 item': () => {
      const testObject = new TestObjectCpp()

      const setOneItem = () => {
        // @ts-expect-error
        testObject.someTuple = [55]
      }
      expect(setOneItem).to.throw(
        `${testObject.constructor.name}.someTuple: The given JS Array has 1 items, but ${debugOnly('std::tuple<double, std::string>')}`
      )
      expect(setOneItem).to.throw('expects 2 items')
    },

    'someTuple throws for a number in place of the string': () => {
      const testObject = new TestObjectCpp()

      expect(() => {
        // @ts-expect-error
        testObject.someTuple = [55, 66]
      }).to.throw(`${testObject.constructor.name}.someTuple: Value is a number, expected a String`)
    },

    'someTuple keeps its value after a failed set': () => {
      const testObject = new TestObjectCpp()

      testObject.someTuple = [13, 'before']
      expect(() => {
        // @ts-expect-error
        testObject.someTuple = [55, 66]
      }).to.throw(`${testObject.constructor.name}.someTuple: `)
      expect(testObject.someTuple).to.deep.equal([13, 'before'])
    },

    'flip(...) keeps NaN, Infinity and -0': () => {
      const testObject = new TestObjectCpp()

      expect(testObject.flip([NaN, Infinity, -0])).to.deep.equal([-0, Infinity, NaN])
    },

    'flip(...) throws for 4 items': () => {
      const testObject = new TestObjectCpp()

      const flipFourItems = () =>
        testObject.flip(
          // @ts-expect-error
          [1, 2, 3, 4]
        )
      expect(flipFourItems).to.throw(
        `${testObject.constructor.name}.flip(...): The given JS Array has 4 items, but ${debugOnly('std::tuple<double, double, double>')}`
      )
      expect(flipFourItems).to.throw('expects 3 items')
    },

    'flip(...) throws for an empty array': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.flip([])
      ).to.throw(`${testObject.constructor.name}.flip(...): The given JS Array has 0 items`)
    },

    'flip(...) throws for a string item': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        testObject.flip(
          // @ts-expect-error
          [1, 'two', 3]
        )
      ).to.throw(`${testObject.constructor.name}.flip(...): Value is a string, expected a number`)
    },

    'flip(...) throws for a non-array object': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.flip({ 0: 1, 1: 2, 2: 3, length: 3 })
      ).to.throw(`${testObject.constructor.name}.flip(...): Object is an object, expected an array`)
    },

    'flip(...) throws for a string': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.flip('abc')
      ).to.throw(`${testObject.constructor.name}.flip(...): Value is a string, expected an Object`)
    },

    'passTuple(...) bounces falsy values': () => {
      const testObject = new TestObjectCpp()

      expect(testObject.passTuple([0, '', false])).to.deep.equal([0, '', false])
    },

    'passTuple(...) throws for a string in place of the boolean': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        testObject.passTuple(
          // @ts-expect-error
          [13, 'hello', 'true']
        )
      ).to.throw(`${testObject.constructor.name}.passTuple(...): Value is a string, expected a boolean`)
    },

    'passTuple(...) throws for a number in place of the string': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        testObject.passTuple(
          // @ts-expect-error
          [13, 42, true]
        )
      ).to.throw(`${testObject.constructor.name}.passTuple(...): Value is a number, expected a String`)
    },

    'passTuple(...) throws for 4 items': () => {
      const testObject = new TestObjectCpp()

      const passFourItems = () =>
        testObject.passTuple(
          // @ts-expect-error
          [13, 'hello', true, 'extra']
        )
      expect(passFourItems).to.throw(
        `${testObject.constructor.name}.passTuple(...): The given JS Array has 4 items, but ${debugOnly('std::tuple<double, std::string, bool>')}`
      )
      expect(passFourItems).to.throw('expects 3 items')
    },

    'bounceCustomType(...) bounces an empty string': () => {
      const testObject = new TestObjectCpp()

      expect(Object.is(testObject.bounceCustomType(''), '')).to.equal(true)
    },

    'bounceCustomType(...) bounces a unicode string': () => {
      const testObject = new TestObjectCpp()

      expect(Object.is(testObject.bounceCustomType('héllo 👋 世界'), 'héllo 👋 世界')).to.equal(true)
    },

    'bounceCustomType(...) keeps an embedded NUL character': () => {
      const testObject = new TestObjectCpp()

      expect(Object.is(testObject.bounceCustomType('a\0b'), 'a\0b')).to.equal(true)
    },

    'bounceCustomType(...) throws for a number': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.bounceCustomType(55)
      ).to.throw(`${testObject.constructor.name}.bounceCustomType(...): Value is a number, expected a String`)
    },

    'bounceAnyHybrid(...) bounces itself': () => {
      const testObject = new TestObjectCpp()

      expect(Object.is(testObject.bounceAnyHybrid(testObject), testObject)).to.equal(true)
    },

    'bounceAnyHybrid(...) bounces a TestObjectSwiftKotlin': () => {
      const testObject = new TestObjectCpp()

      const swiftKotlinObject = new TestObjectSwiftKotlin()

      expect(Object.is(testObject.bounceAnyHybrid(swiftKotlinObject), swiftKotlinObject)).to.equal(true)
    },

    'bounceAnyHybrid(...) bounces a Swift Child created from C++': () => {
      const testObject = new TestObjectCpp()

      const child = testObject.createChild()
      expect(Object.is(testObject.bounceAnyHybrid(child), child)).to.equal(true)
    },

    'bounceAnyHybrid(...) bounces a Swift/Kotlin Child': () => {
      const testObject = new TestObjectCpp()

      const child = new TestObjectSwiftKotlin().createChild()
      expect(Object.is(testObject.bounceAnyHybrid(child), child)).to.equal(true)
    },

    'bounceAnyHybrid(...) bounces a Swift/Kotlin Base': () => {
      const testObject = new TestObjectCpp()

      const base = new TestObjectSwiftKotlin().createBase()
      expect(Object.is(testObject.bounceAnyHybrid(base), base)).to.equal(true)
    },

    'bounceAnyHybrid(...) throws for a plain object': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.bounceAnyHybrid({})
      ).to.throw(
        `${testObject.constructor.name}.bounceAnyHybrid(...): Cannot convert "[object Object]" to NativeState<${debugOnly('margelo::nitro::HybridObject>! It does not have a NativeState!')}`
      )
    },

    'bounceAnyHybrid(...) throws for undefined': () => {
      const testObject = new TestObjectCpp()

      expect(() =>
        // @ts-expect-error
        testObject.bounceAnyHybrid(undefined)
      ).to.throw(
        `${testObject.constructor.name}.bounceAnyHybrid(...): Cannot convert "undefined" to NativeState<margelo::nitro::HybridObject>! It is undefined!`
      )
    },

    'rawJsiFunc() returns an empty array without arguments': () => {
      const testObject = new TestObjectCpp()

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc

      expect(rawObject.rawJsiFunc()).to.deep.equal([])
    },

    'rawJsiFunc(...) keeps undefined and null arguments': () => {
      const testObject = new TestObjectCpp()

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc

      expect(rawObject.rawJsiFunc(undefined, null)).to.deep.equal([undefined, null])
    },

    'rawJsiFunc(...) passes objects by reference': () => {
      const testObject = new TestObjectCpp()

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc

      const object = { some: 'object' }
      const [result] = rawObject.rawJsiFunc(object) as unknown[]
      expect(Object.is(result, object)).to.equal(true)
    },

    'rawJsiFunc(...) passes functions by reference': () => {
      const testObject = new TestObjectCpp()

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc

      const func = () => {}
      const [result] = rawObject.rawJsiFunc(func) as unknown[]
      expect(Object.is(result, func)).to.equal(true)
    },

    'rawJsiFunc(...) throws for a `this` without NativeState': () => {
      const testObject = new TestObjectCpp()

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc

      expect(() => rawObject.rawJsiFunc.call({})).to.throw(
        'Cannot call hybrid function `HybridTestObjectCpp.rawJsiFunc(...)` - `this` does not have a NativeState!'
      )
    },

    'rawJsiFunc(...) throws for a different HybridObject as `this`': () => {
      const testObject = new TestObjectCpp()

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc

      expect(() => rawObject.rawJsiFunc.call(HybridSomeExternalObject)).to.throw(
        "Cannot call hybrid function `HybridTestObjectCpp.rawJsiFunc(...)` - `this` has a NativeState, but it's the wrong type!"
      )
    },
  }),
  ...namedCases('Swift values from a C++-only module', {
    'projects the external struct and enum into the consuming Swift module': () => {
      const object = new TestObjectSwiftKotlin()
      for (const kind of [CppOnlyValueKind.First, CppOnlyValueKind.Second]) {
        const value = { label: 'external C++ value', kind }
        expect(object.bounceCppOnlyValue(value)).to.deep.equal(value)
      }
    },
  }),
  ...namedCases('Namespaced HybridObjects', {
    'same-named exports identify their own native implementations': () => {
      expect(Base).not.to.equal(ExternalBase)
      expect(new TestObjectSwiftKotlin().createBase().baseValue).to.equal(10)
      expect(new ExternalBase().baseValue).to.equal(20)
    },

    "registry lookups return each package's exported constructor": () => {
      expect(NitroModules.getHybridClass<typeof Base>('test.Base')).to.equal(Base)
      expect(NitroModules.getHybridClass<typeof ExternalBase>('test.external.Base')).to.equal(ExternalBase)
      expect(NitroModules.hasHybridClass('Base')).to.equal(false)
    },

    'same-named classes have independent prototypes': () => {
      const local = new TestObjectSwiftKotlin().createBase()
      const external = new ExternalBase()
      expect(local).to.be.instanceOf(Base)
      expect(local).not.to.be.instanceOf(ExternalBase)
      expect(external).to.be.instanceOf(ExternalBase)
      expect(external).not.to.be.instanceOf(Base)
    },

    'constructor names and object descriptions stay unqualified': () => {
      expect(Base.name).to.equal('Base')
      expect(ExternalBase.name).to.equal('Base')
      for (const object of [new TestObjectSwiftKotlin().createBase(), new ExternalBase()]) {
        expect(object.constructor.name).to.equal('Base')
        expect(object.toString()).to.equal('[HybridObject Base]')
      }
    },
  }),
  ...namedCases('Namespaced custom types', {
    "same-named structs preserve each module's fields": () => {
      expect(new TestObjectSwiftKotlin().createBase().bounceSize(LOCAL_SIZE)).to.deep.equal(LOCAL_SIZE)
      expect(new ExternalBase().bounceSize(EXTERNAL_SIZE)).to.deep.equal(EXTERNAL_SIZE)
    },

    "same-named enums preserve each module's members and values": () => {
      const local = new TestObjectSwiftKotlin().createBase()
      const external = new ExternalBase()
      expect(local.bounceSizeUnit(SizeUnit.Points)).to.equal(SizeUnit.Points)
      expect(local.bounceSizeUnit(SizeUnit.Pixels)).to.equal(SizeUnit.Pixels)
      expect(external.bounceSizeUnit(ExternalSizeUnit.Pixels)).to.equal(ExternalSizeUnit.Pixels)
      expect(external.bounceSizeUnit(ExternalSizeUnit.Normalized)).to.equal(ExternalSizeUnit.Normalized)
    },

    "callbacks and promises use their module's struct and enum": async () => {
      let localCalls = 0
      let externalCalls = 0
      const localResult: Size = {
        width: 320,
        height: 240,
        unit: SizeUnit.Points,
      }
      const externalResult: ExternalSize = {
        width: 1,
        height: 1,
        unit: ExternalSizeUnit.Normalized,
        scale: 3,
      }
      const [local, external] = await Promise.all([
        new TestObjectSwiftKotlin().createBase().mapSize(LOCAL_SIZE, (size) => {
          localCalls += 1
          expect(size).to.deep.equal(LOCAL_SIZE)
          return localResult
        }),
        new ExternalBase().mapSize(EXTERNAL_SIZE, (size) => {
          externalCalls += 1
          expect(size).to.deep.equal(EXTERNAL_SIZE)
          return externalResult
        }),
      ])
      expect(localCalls).to.equal(1)
      expect(externalCalls).to.equal(1)
      expect(local).to.deep.equal(localResult)
      expect(external).to.deep.equal(externalResult)
    },
  }),
  // Both modules bridge these C++ specializations. Each case pairs one external
  // implementation (C++ or Swift/Kotlin) with one local implementation.
  ...casesForSharedSpecializations('Promise and Callback specializations shared across modules', {
    'Promises resolve from both modules': async (external, local) => {
      await external.resolveVoid()
      await local.promiseThatResolvesVoidInstantly()
      expect(await external.resolveNumber(13)).to.equal(13)
      expect(await local.promiseReturnsInstantly()).to.equal(55)
      expect(await external.resolveString('external')).to.equal('external')
    },

    'both modules await JS Promises': async (external, local) => {
      await external.awaitVoid(Promise.resolve())
      await local.awaitPromise(Promise.resolve())
      expect(await external.awaitNumber(Promise.resolve(7))).to.equal(7)
      expect(await local.awaitAndGetPromise(Promise.resolve(8))).to.equal(8)
    },

    'both modules forward JS Promise rejections': async (external, local) => {
      const externalError = await rejection(external.awaitNumber(Promise.reject(new Error('external rejection'))))
      expect(externalError).to.be.instanceOf(Error)
      expect((externalError as Error).message).to.include('external rejection')
      const localError = await rejection(local.awaitAndGetPromise(Promise.reject(new Error('local rejection'))))
      expect(localError).to.be.instanceOf(Error)
      expect((localError as Error).message).to.include('local rejection')
    },

    'both modules call JS callbacks': async (external, local) => {
      const voidCallback = recordCallback()
      external.callVoid(voidCallback)
      local.callCallback(voidCallback)
      const numberCallback = recordCallback()
      external.callWithNumber(3, numberCallback)
      const stringCallback = recordCallback()
      external.callWithString('external', stringCallback)
      await waitFor(() => expect(voidCallback.calls).to.have.length(2), CALLBACK_TIMEOUT)
      await waitFor(() => expect(numberCallback.calls).to.deep.equal([[3]]), CALLBACK_TIMEOUT)
      await waitFor(() => expect(stringCallback.calls).to.deep.equal([['external']]), CALLBACK_TIMEOUT)
    },

    'both modules return native callbacks': async (external, local) => {
      const wrapped = recordCallback()
      external.wrapNumberCallback(wrapped)(1)
      local.createNativeCallback(wrapped)(2)
      await waitFor(() => expect(wrapped.calls).to.have.deep.members([[1], [2]]), CALLBACK_TIMEOUT)
    },

    'both modules await callbacks with results': async (external, local) => {
      expect(await external.mapNumber(20, (value) => value + 1)).to.equal(21)
      let localCalls = 0
      await local.callCallbackThatReturnsPromiseVoid(async () => {
        localCalls += 1
      })
      let externalCalls = 0
      await external.callVoidPromiseCallback(async () => {
        externalCalls += 1
      })
      expect(localCalls).to.equal(1)
      expect(externalCalls).to.equal(1)
      expect(await external.callNumberPromiseCallback(async () => 34)).to.equal(34)
      expect(await local.callbackAsyncPromise(async () => 35)).to.equal(35)
    },

    'callback properties keep their value': async (external) => {
      const callback = recordCallback()
      external.numberCallback = callback
      external.numberCallback(5)
      await waitFor(() => expect(callback.calls).to.deep.equal([[5]]), CALLBACK_TIMEOUT)
    },

    'both modules call inline callbacks': (external, local) => {
      let calls = 0
      external.callInline(() => {
        calls += 1
      })
      local.callInlineCallback(() => {
        calls += 1
      })
      expect(calls).to.equal(2)
      expect(external.callInlineWithNumber(6, (value) => value * 2)).to.equal(12)
      expect(local.callInlineCallbackWithValue(7, (value) => value * 2)).to.equal(14)
    },
  }),
  ...namedCases('SomeExternalObject optional primitives', {
    'createOptionalPrimitivesHolder(5) only sets optionalNumber': () => {
      expect(HybridSomeExternalObject.createOptionalPrimitivesHolder(5)).to.deep.equal({
        optionalNumber: 5,
        optionalBoolean: undefined,
        optionalUInt64: undefined,
        optionalInt64: undefined,
      })
    },

    'createOptionalPrimitivesHolder(undefined, true) only sets optionalBoolean': () => {
      expect(HybridSomeExternalObject.createOptionalPrimitivesHolder(undefined, true)).to.deep.equal({
        optionalNumber: undefined,
        optionalBoolean: true,
        optionalUInt64: undefined,
        optionalInt64: undefined,
      })
    },

    'createOptionalPrimitivesHolder() leaves every field undefined': () => {
      expect(HybridSomeExternalObject.createOptionalPrimitivesHolder()).to.deep.equal({
        optionalNumber: undefined,
        optionalBoolean: undefined,
        optionalUInt64: undefined,
        optionalInt64: undefined,
      })
    },

    'createOptionalPrimitivesHolder(5, true, 7n, 13n) sets every field': () => {
      expect(HybridSomeExternalObject.createOptionalPrimitivesHolder(5, true, 7n, 13n)).to.deep.equal({
        optionalNumber: 5,
        optionalBoolean: true,
        optionalUInt64: 7n,
        optionalInt64: 13n,
      })
    },

    'createOptionalPrimitivesHolder(0, false, 0n, 0n) keeps falsy values': () => {
      expect(HybridSomeExternalObject.createOptionalPrimitivesHolder(0, false, 0n, 0n)).to.deep.equal({
        optionalNumber: 0,
        optionalBoolean: false,
        optionalUInt64: 0n,
        optionalInt64: 0n,
      })
    },

    'createOptionalPrimitivesHolder(...) keeps UInt64 max and Int64 min': () => {
      const holder = HybridSomeExternalObject.createOptionalPrimitivesHolder(undefined, undefined, UINT64_MAX, INT64_MIN)
      expect(Object.is(holder.optionalUInt64, UINT64_MAX)).to.equal(true)
      expect(Object.is(holder.optionalInt64, INT64_MIN)).to.equal(true)
    },

    'createOptionalPrimitivesHolder(...) keeps Int64 max': () => {
      expect(
        Object.is(
          HybridSomeExternalObject.createOptionalPrimitivesHolder(undefined, undefined, undefined, INT64_MAX).optionalInt64,
          INT64_MAX
        )
      ).to.equal(true)
    },
  }),
  ...namedCases('SomeExternalObject', {
    'getValue() returns "Hello world!"': () => {
      expect(Object.is(HybridSomeExternalObject.getValue(), 'Hello world!')).to.equal(true)
    },

    'name is "SomeExternalObject"': () => {
      expect(Object.is(HybridSomeExternalObject.constructor.name, 'SomeExternalObject')).to.equal(true)
    },

    'toString() is "[HybridObject SomeExternalObject]"': () => {
      expect(Object.is(HybridSomeExternalObject.toString(), '[HybridObject SomeExternalObject]')).to.equal(true)
    },
  }),
  ...casesForTestObjects('External HybridObjects', {
    'bounceExternalHybrid(...) returns the same object': (testObject) => {
      expect(Object.is(testObject.bounceExternalHybrid(HybridSomeExternalObject), HybridSomeExternalObject)).to.equal(true)
    },

    'bounceExternalStruct(...) returns the same struct': (testObject) => {
      const result = testObject.bounceExternalStruct({
        someExternal: HybridSomeExternalObject,
      })
      expect(Object.keys(result)).to.deep.equal(['someExternal'])
      expect(Object.is(result.someExternal, HybridSomeExternalObject)).to.equal(true)
    },

    'bounceExternalVariant(...) returns a string': (testObject) => {
      expect(Object.is(testObject.bounceExternalVariant('Hello!'), 'Hello!')).to.equal(true)
    },

    'bounceExternalVariant(...) returns an external object': (testObject) => {
      expect(Object.is(testObject.bounceExternalVariant(HybridSomeExternalObject), HybridSomeExternalObject)).to.equal(true)
    },

    'createExternalVariantFromFunc(...) returns the factory result': (testObject) => {
      const factory = () => HybridSomeExternalObject
      expect(Object.is(testObject.createExternalVariantFromFunc(factory), HybridSomeExternalObject)).to.equal(true)
    },

    'createInternalObject() returns a subclass that overrides getValue()': (testObject) => {
      const object = testObject.createInternalObject()
      expect(Object.is(object, HybridSomeExternalObject)).to.equal(false)
      expect(Object.is(object.getValue(), 'This is overridden!')).to.equal(true)
    },
  }),
  ...casesForTestObjects('External HybridObject subclasses', {
    'createInternalObject() is named "SomeExternalObject"': (testObject) => {
      expect(Object.is(testObject.createInternalObject().constructor.name, 'SomeExternalObject')).to.equal(true)
    },

    'createInternalObject() returns a new object every call': (testObject) => {
      expect(Object.is(testObject.createInternalObject(), testObject.createInternalObject())).to.equal(false)
    },

    'createInternalObject() implements createOptionalPrimitivesHolder(...)': (testObject) => {
      expect(testObject.createInternalObject().createOptionalPrimitivesHolder(1.5, false, 2n, -3n)).to.deep.equal({
        optionalNumber: 1.5,
        optionalBoolean: false,
        optionalUInt64: 2n,
        optionalInt64: -3n,
      })
    },

    'bounceExternalHybrid(createInternalObject()) returns the same object': (testObject) => {
      const internal = testObject.createInternalObject()
      expect(Object.is(testObject.bounceExternalHybrid(internal), internal)).to.equal(true)
    },

    'bounceExternalVariant(createInternalObject()) returns the same object': (testObject) => {
      const internal = testObject.createInternalObject()
      expect(Object.is(testObject.bounceExternalVariant(internal), internal)).to.equal(true)
    },

    'bounceExternalStruct(...) keeps an internal object': (testObject) => {
      const internal = testObject.createInternalObject()
      expect(Object.is(testObject.bounceExternalStruct({ someExternal: internal }).someExternal, internal)).to.equal(true)
    },

    'createExternalVariantFromFunc(...) returns an internal object': (testObject) => {
      const internal = testObject.createInternalObject()
      expect(
        Object.is(
          testObject.createExternalVariantFromFunc(() => internal),
          internal
        )
      ).to.equal(true)
    },
  }),
  ...casesForTestObjects('External HybridObject conversions', {
    'createExternalVariantFromFunc(...) calls the factory once': (testObject) => {
      const factory = recordCallback(() => HybridSomeExternalObject)
      testObject.createExternalVariantFromFunc(factory)
      expect(factory.calls).to.have.length(1)
    },

    'bounceExternalVariant(number) throws': (testObject) => {
      // Debug diagnostics name the native representation used by each API.
      let nativeObjectType: string
      if (isSwift(testObject) || isKotlin(testObject)) {
        nativeObjectType = 'std::shared_ptr<margelo::nitro::test::external::HybridSomeExternalObjectSpec>'
      } else {
        nativeObjectType = 'margelo::nitro::test::adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx'
      }
      // @ts-expect-error - a number is neither a string nor a SomeExternalObject
      expect(() => testObject.bounceExternalVariant(55)).to.throw(
        `${testObject.constructor.name}.bounceExternalVariant(...): Cannot convert "55" to any type in variant<${debugOnly(`${nativeObjectType}, std::string>!`)}`
      )
    },

    'bounceExternalVariant(another HybridObject type) throws': (testObject) => {
      // @ts-expect-error - a TestObject is not a SomeExternalObject
      expect(() => testObject.bounceExternalVariant(testObject)).to.throw(
        `Cannot convert "[HybridObject ${testObject.constructor.name}]" to any type in variant<`
      )
    },

    'bounceExternalHybrid(another HybridObject type) throws': (testObject) => {
      // @ts-expect-error - a TestObject is not a SomeExternalObject
      expect(() => testObject.bounceExternalHybrid(testObject)).to.throw('Downcasting failed - It has a different NativeState<T>!')
    },

    'bounceExternalHybrid({}) throws because it has no NativeState': (testObject) => {
      // @ts-expect-error - a plain object is not a SomeExternalObject
      const bouncePlainObject = () => testObject.bounceExternalHybrid({})
      expect(bouncePlainObject).to.throw(`${testObject.constructor.name}.bounceExternalHybrid(...)`)
      expect(bouncePlainObject).to.throw('It does not have a NativeState!')
    },

    'bounceExternalStruct({}) throws for the missing object': (testObject) => {
      // @ts-expect-error - `someExternal` is missing
      expect(() => testObject.bounceExternalStruct({})).to.throw('It is undefined!')
    },
  }),
  ...namedCases('C++ consuming Swift HybridObjects', {
    'adapter factories preserve the registered Swift classes': () => {
      const object = new TestObjectCpp(new PlatformObject())
      const base = object.createBase()
      const child = object.createChild()
      expect(base).to.be.instanceOf(Base)
      expect(child).to.be.instanceOf(Child)
      expect(child).to.be.instanceOf(Base)
      expect(base.constructor).to.equal(Base)
      expect(child.constructor).to.equal(Child)
    },

    'calls dispatch to the actual Swift implementation': () => {
      const object = new TestObjectCpp()
      expect(object.readBaseValue(new TestObjectSwiftKotlin().createBase())).to.equal(10)
      expect(object.readBaseValue(new TestObjectSwiftKotlin().createChild())).to.equal(20)
      expect(object.readChildBaseValue(new TestObjectSwiftKotlin().createChild())).to.equal(20)
    },

    'ancestor adapters dispatch through three Swift inheritance levels': () => {
      const object = new TestObjectCpp()
      const grandchild = new Grandchild()
      expect(object.readBaseValue(grandchild)).to.equal(20)
      expect(object.readChildBaseValue(grandchild)).to.equal(20)
      expect(object.bounceSizeThroughBase(grandchild, SIZE)).to.deep.equal(SIZE)
      expect(object.bounceVariantThroughChild(grandchild, TEST_CAR)).to.deep.equal(TEST_CAR)
    },

    'multiple Swift implementations share the same class and prototype': () => {
      const object = new TestObjectCpp()
      const alternative = object.createAlternativeBase()
      expect(alternative).to.be.instanceOf(Base)
      expect(alternative.constructor).to.equal(Base)
      expect(Object.is(Object.getPrototypeOf(alternative), Base.prototype)).to.equal(true)
      expect(alternative.baseValue).to.equal(11)
      expect(object.readBaseValue(alternative)).to.equal(11)
      expect(object.bounceBase(alternative)).to.equal(alternative)
    },

    'converts structs and enums for a Swift method call': () => {
      const object = new TestObjectCpp()
      expect(object.bounceSizeThroughBase(new TestObjectSwiftKotlin().createBase(), SIZE)).to.deep.equal(SIZE)
      expect(object.bounceSizeThroughBase(new TestObjectSwiftKotlin().createChild(), SIZE)).to.deep.equal(SIZE)
    },

    'converts a callback and Promise around a Swift method call': async () => {
      const object = new TestObjectCpp()
      const result: Size = { width: 20, height: 30, unit: SizeUnit.Points }
      let calls = 0
      const value = await object.mapSizeThroughBase(new TestObjectSwiftKotlin().createChild(), SIZE, (size) => {
        calls += 1
        expect(size).to.deep.equal(SIZE)
        return result
      })
      expect(calls).to.equal(1)
      expect(value).to.deep.equal(result)
    },

    'converts both members of a Swift variant': () => {
      const object = new TestObjectCpp()
      const child = new TestObjectSwiftKotlin().createChild()
      expect(object.bounceVariantThroughChild(child, 'hello')).to.equal('hello')
      expect(object.bounceVariantThroughChild(child, TEST_CAR)).to.deep.equal(TEST_CAR)
    },

    'retaining and returning an adapter preserves JS identity': () => {
      const object = new TestObjectCpp()
      const child = new TestObjectSwiftKotlin().createChild()
      expect(object.retainedBase).to.equal(undefined)
      object.retainedBase = child
      expect(object.retainedBase).to.equal(child)
      expect(object.castBase(object.retainedBase!)).to.equal(child)
      object.retainedBase = undefined
      expect(object.retainedBase).to.equal(undefined)
    },

    'retained adapters keep Swift objects alive across JS garbage collection': () => {
      const object = new TestObjectCpp()
      object.retainedBase = new TestObjectSwiftKotlin().createChild()
      gc()
      const child = object.retainedBase!
      expect(child).to.be.instanceOf(Child)
      expect(child).to.be.instanceOf(Base)
      expect(object.readBaseValue(child)).to.equal(20)
      expect(object.castBase(child)).to.equal(child)
      object.retainedBase = undefined
    },

    'external adapters call the original Swift implementation': () => {
      const object = new TestObjectCpp()
      const external = new ExternalBase().createExternalObject()
      expect(object.readExternalValue(external)).to.equal('Hello world!')
      expect(object.bounceExternalHybrid(external)).to.equal(external)
    },

    'external Swift structs preserve populated optional fields': () => {
      const object = new TestObjectCpp()
      const external = new ExternalBase().createExternalObject()
      expect(object.createExternalOptionalPrimitives(external, 4.5, true, 13n, -7n)).to.deep.equal({
        optionalNumber: 4.5,
        optionalBoolean: true,
        optionalUInt64: 13n,
        optionalInt64: -7n,
      })
    },

    'external Swift structs preserve absent optional fields': () => {
      const object = new TestObjectCpp()
      expect(object.createExternalOptionalPrimitives(new ExternalBase().createExternalObject())).to.deep.equal({
        optionalNumber: undefined,
        optionalBoolean: undefined,
        optionalUInt64: undefined,
        optionalInt64: undefined,
      })
    },

    'external Swift structs preserve false, zero, and integer limits': () => {
      const object = new TestObjectCpp()
      const external = object.createInternalObject()
      expect(object.createExternalOptionalPrimitives(external, 0, false, 2n ** 64n - 1n, -(2n ** 63n))).to.deep.equal({
        optionalNumber: 0,
        optionalBoolean: false,
        optionalUInt64: 2n ** 64n - 1n,
        optionalInt64: -(2n ** 63n),
      })
    },

    'external protocol implementations keep their class and dispatch': () => {
      const object = new TestObjectCpp()
      const internal = object.createInternalObject()
      expect(internal).to.be.instanceOf(SomeExternalObject)
      expect(internal.constructor).to.equal(SomeExternalObject)
      expect(object.readExternalValue(internal)).to.equal('This is overridden!')
      expect(object.bounceExternalHybrid(internal)).to.equal(internal)
    },
  }),
  ...namedCases('Declared C++ inheritance', {
    'constructors and prototypes follow the declared hierarchy': () => {
      const base = new TestObjectCpp().createCppBase()
      const child = new TestObjectCpp().createCppChild()
      expect(base).to.be.instanceOf(CppBase)
      expect(child).to.be.instanceOf(CppChild)
      expect(child).to.be.instanceOf(CppBase)
      expect(Object.is(Object.getPrototypeOf(CppChild), CppBase)).to.equal(true)
      expect(Object.is(Object.getPrototypeOf(CppChild.prototype), CppBase.prototype)).to.equal(true)
      expect(NitroModules.isHybridObject(child)).to.equal(true)
    },

    'factories reuse the registered C++ class': () => {
      const object = new TestObjectCpp()
      expect(object.createCppBase()).to.be.instanceOf(CppBase)
      const child = object.createCppChild()
      expect(child.constructor).to.equal(CppChild)
      expect(child).to.be.instanceOf(CppChild)
      expect(child).to.be.instanceOf(CppBase)
      expect(object.createCppBaseActualChild()).to.be.instanceOf(CppChild)
    },

    'inherited methods call the C++ implementation': async () => {
      const child = new TestObjectCpp().createCppChild()
      expect(new TestObjectCpp().createCppBase().baseValue).to.equal(10)
      expect(child.baseValue).to.equal(20)
      expect(child.childValue).to.equal(30)
      expect(child.toString()).to.equal('HybridCppChild custom toString() :)')
      expect(child.bounceSize(SIZE)).to.deep.equal(SIZE)
      expect(child.bounceSizeUnit(SizeUnit.Pixels)).to.equal(SizeUnit.Pixels)
      expect(child.bounceVariant(TEST_CAR)).to.deep.equal(TEST_CAR)
      expect(await child.mapSize(SIZE, (size) => size)).to.deep.equal(SIZE)
    },

    'upcasting and downcasting preserve the original object': () => {
      const object = new TestObjectCpp()
      const child = new TestObjectCpp().createCppChild()
      const base = object.bounceCppBase(child)
      expect(base).to.equal(child)
      expect(object.castCppBase(base)).to.equal(child)
      expect(() => object.castCppBase(new TestObjectCpp().createCppBase())).to.throw('Cannot cast CppBase to CppChild!')
    },

    'three-level constructors and prototypes follow the declared C++ hierarchy': () => {
      const object = new TestObjectCpp()
      for (const grandchild of [new CppGrandchild(), object.createCppGrandchild()]) {
        expect(grandchild).to.be.instanceOf(CppGrandchild)
        expect(grandchild).to.be.instanceOf(CppChild)
        expect(grandchild).to.be.instanceOf(CppBase)
        expect(grandchild.constructor).to.equal(CppGrandchild)
        expect(NitroModules.isHybridObject(grandchild)).to.equal(true)
      }
      expect(Object.is(Object.getPrototypeOf(CppGrandchild), CppChild)).to.equal(true)
      expect(Object.is(Object.getPrototypeOf(CppGrandchild.prototype), CppChild.prototype)).to.equal(true)
    },

    'three-level C++ inheritance dispatches inherited methods and getters': async () => {
      const grandchild = new CppGrandchild()
      expect(grandchild.baseValue).to.equal(20)
      expect(grandchild.childValue).to.equal(30)
      expect(grandchild.grandchildValue).to.equal(40)
      expect(grandchild.toString()).to.equal('HybridCppChild custom toString() :)')
      expect(grandchild.bounceSize(SIZE)).to.deep.equal(SIZE)
      expect(grandchild.bounceSizeUnit(SizeUnit.Points)).to.equal(SizeUnit.Points)
      expect(grandchild.bounceVariant(TEST_CAR)).to.deep.equal(TEST_CAR)
      expect(await grandchild.mapSize(SIZE, (size) => size)).to.deep.equal(SIZE)
    },

    'three-level C++ upcasts and downcasts preserve the original object': () => {
      const object = new TestObjectCpp()
      const grandchild = object.createCppGrandchild()
      const base = object.bounceCppBase(grandchild)
      expect(base).to.equal(grandchild)
      expect(object.castCppBase(base)).to.equal(grandchild)
      expect(base).to.be.instanceOf(CppGrandchild)
      expect(base).to.be.instanceOf(CppChild)
      expect(base).to.be.instanceOf(CppBase)
    },

    'C++ and Swift classes keep distinct identities': () => {
      expect(new TestObjectCpp().createCppBase()).not.to.be.instanceOf(Base)
      expect(new TestObjectSwiftKotlin().createBase()).not.to.be.instanceOf(CppBase)
      expect(new TestObjectCpp().createCppChild()).not.to.be.instanceOf(Child)
      expect(new TestObjectSwiftKotlin().createChild()).not.to.be.instanceOf(CppChild)
    },
  }),
}

export const skips = {
  'C++ only / TestObjectCpp / bounceAnyHybrid(...) throws for undefined': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'C++ only / TestObjectCpp / rawJsiFunc(...) throws for a `this` without NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'C++ only / TestObjectCpp / rawJsiFunc(...) throws for a different HybridObject as `this`': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'External HybridObject conversions / TestObjectCpp / bounceExternalHybrid(another HybridObject type) throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'External HybridObject conversions / TestObjectSwiftKotlin / bounceExternalHybrid(another HybridObject type) throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'External HybridObject conversions / TestObjectCpp / bounceExternalHybrid({}) throws because it has no NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'External HybridObject conversions / TestObjectSwiftKotlin / bounceExternalHybrid({}) throws because it has no NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'External HybridObject conversions / TestObjectCpp / bounceExternalStruct({}) throws for the missing object': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'External HybridObject conversions / TestObjectSwiftKotlin / bounceExternalStruct({}) throws for the missing object': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
} as const
