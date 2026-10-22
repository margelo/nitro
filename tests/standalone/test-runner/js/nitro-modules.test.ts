import { casesForTestObjects, namedCases } from './utils/cases'

import { expect } from 'chai'

import { NitroModules } from 'nitro-core'
import nitroModulesPackage from 'nitro-core/package.json'

import { Base } from 'nitro-test'
import { Child } from 'nitro-test'
import { PlatformObject } from 'nitro-test'

import { TestObjectCpp, TestObjectSwiftKotlin } from 'nitro-test'
import { HybridSomeExternalObject } from './utils/testObjects'
import { Base as ExternalBase, SomeExternalObject } from 'nitro-test-external'

const UNKNOWN_NAME = 'SomeUnregisteredHybridObject'

// Every autolinked non-view HybridObject. Views are left out because they
// create platform views, which must happen on the UI Thread.
const REGISTERED_NAMES = [
  'test.TestObjectCpp',
  'test.TestObjectSwiftKotlin',
  'test.Base',
  'test.Child',
  'test.PlatformObject',
  'test.external.SomeExternalObject',
  'test.external.Base',
]

const PRIMITIVES: { label: string; value: unknown }[] = [
  { label: 'undefined', value: undefined },
  { label: 'null', value: null },
  { label: '42', value: 42 },
  { label: "'TestObjectCpp'", value: 'TestObjectCpp' },
]

export const cases = {
  ...namedCases('PlatformObject', {
    'getOSVersion() returns a nonempty OS version string': () => {
      const platform = new PlatformObject()
      expect(platform.getOSVersion()).to.be.a('string').and.not.be.empty
    },
  }),
  ...namedCases('NitroModules', {
    'createNativeArrayBuffer(...) returns a writable ArrayBuffer': () => {
      const buffer = NitroModules.createNativeArrayBuffer(1024)
      expect(buffer).to.be.instanceOf(ArrayBuffer)
      expect(Object.is(buffer.byteLength, 1024)).to.equal(true)

      const array = new Uint8Array(buffer)
      array[0] = 13
      expect(Object.is(array[0], 13)).to.equal(true)
    },

    'buildType is debug or release': () => {
      expect(NitroModules.buildType).to.be.oneOf(['debug', 'release'])
    },

    'version is a semver string': () => {
      expect(NitroModules.version).to.be.a('string')
      expect(NitroModules.version).to.match(/^\d+\.\d+\.\d+/)
    },

    'getAllHybridClassNames() returns every autolinked HybridObject': () => {
      const names = NitroModules.getAllHybridClassNames()
      expect(names).to.be.instanceOf(Array)
      expect(names).to.include.members(REGISTERED_NAMES)
    },

    'version matches the nitro-core JS package': () => {
      expect(Object.is(NitroModules.version, nitroModulesPackage.version)).to.equal(true)
    },

    'name is "NitroModulesProxy"': () => {
      expect(Object.is(NitroModules.constructor.name, 'NitroModulesProxy')).to.equal(true)
    },

    'toString() is "[HybridObject NitroModulesProxy]"': () => {
      expect(Object.is(NitroModules.toString(), '[HybridObject NitroModulesProxy]')).to.equal(true)
    },

    'isHybridObject(NitroModules) is true': () => {
      expect(Object.is(NitroModules.isHybridObject(NitroModules), true)).to.equal(true)
    },

    'createNativeArrayBuffer(0) has a byteLength of 0': () => {
      const size = [0, 1, 4097, 16 * 1024 * 1024][0]!

      expect(Object.is(NitroModules.createNativeArrayBuffer(size).byteLength, size)).to.equal(true)
    },

    'createNativeArrayBuffer(1) has a byteLength of 1': () => {
      const size = [0, 1, 4097, 16 * 1024 * 1024][1]!

      expect(Object.is(NitroModules.createNativeArrayBuffer(size).byteLength, size)).to.equal(true)
    },

    'createNativeArrayBuffer(4097) has a byteLength of 4097': () => {
      const size = [0, 1, 4097, 16 * 1024 * 1024][2]!

      expect(Object.is(NitroModules.createNativeArrayBuffer(size).byteLength, size)).to.equal(true)
    },

    'createNativeArrayBuffer(16777216) has a byteLength of 16777216': () => {
      const size = [0, 1, 4097, 16 * 1024 * 1024][3]!

      expect(Object.is(NitroModules.createNativeArrayBuffer(size).byteLength, size)).to.equal(true)
    },

    'createNativeArrayBuffer(...) returns independent memory every call': () => {
      const a = new Uint8Array(NitroModules.createNativeArrayBuffer(8))
      const b = new Uint8Array(NitroModules.createNativeArrayBuffer(8))
      a[0] = 1
      b[0] = 2
      expect([a[0], b[0]]).to.deep.equal([1, 2])
    },
  }),
  ...namedCases('NitroModules registry', {
    'hasHybridClass(unknown name) is false': () => {
      expect(Object.is(NitroModules.hasHybridClass(UNKNOWN_NAME), false)).to.equal(true)
    },

    'hasHybridClass(...) is case-sensitive': () => {
      expect(Object.is(NitroModules.hasHybridClass('test.testobjectcpp'), false)).to.equal(true)
    },

    'getAllHybridClassNames() has no duplicates': () => {
      const names = NitroModules.getAllHybridClassNames()
      expect(names).to.deep.equal([...new Set(names)])
    },

    'hasHybridClass(...) is true for every getAllHybridClassNames() entry': () => {
      const missing = NitroModules.getAllHybridClassNames().filter((name) => !NitroModules.hasHybridClass(name))
      expect(missing).to.deep.equal([])
    },

    'getHybridClass(unknown name) throws a not-registered error': () => {
      const create = () => NitroModules.getHybridClass<typeof Base>(UNKNOWN_NAME)
      expect(create).to.throw(`HybridClass "${UNKNOWN_NAME}" is not registered.`)
    },

    'getHybridClass(unknown name) error asks to regenerate bindings': () => {
      expect(() => NitroModules.getHybridClass<typeof Base>(UNKNOWN_NAME)).to.throw(
        'Regenerate Nitrogen bindings and rebuild the native app.'
      )
    },

    'getHybridClass(\'test.TestObjectCpp\') returns an object named "TestObjectCpp"': () => {
      const name = 'test.TestObjectCpp'

      const object = new (NitroModules.getHybridClass<typeof TestObjectCpp>(name))()
      expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(true)
      expect(Object.is(object.constructor.name, 'TestObjectCpp')).to.equal(true)
    },

    'getHybridClass(\'test.TestObjectSwiftKotlin\') returns an object named "TestObjectSwiftKotlin"': () => {
      const name = 'test.TestObjectSwiftKotlin'

      const object = new (NitroModules.getHybridClass<typeof TestObjectSwiftKotlin>(name))()
      expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(true)
      expect(Object.is(object.constructor.name, 'TestObjectSwiftKotlin')).to.equal(true)
    },

    'getHybridClass(\'test.Base\') returns an object named "Base"': () => {
      const name = 'test.Base'

      const hybridClass = NitroModules.getHybridClass<typeof Base>(name)
      const object = new TestObjectSwiftKotlin().createBase()
      expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(true)
      expect(Object.is(object.constructor.name, 'Base')).to.equal(true)
      expect(object).to.be.instanceOf(hybridClass)
      expect(() => Reflect.construct(hybridClass, [])).to.throw('has no public constructor.')
    },

    'getHybridClass(\'test.Child\') returns an object named "Child"': () => {
      const name = 'test.Child'

      const hybridClass = NitroModules.getHybridClass<typeof Child>(name)
      const object = new TestObjectSwiftKotlin().createChild()
      expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(true)
      expect(Object.is(object.constructor.name, 'Child')).to.equal(true)
      expect(object).to.be.instanceOf(hybridClass)
      expect(() => Reflect.construct(hybridClass, [])).to.throw('has no public constructor.')
    },

    'getHybridClass(\'test.PlatformObject\') returns an object named "PlatformObject"': () => {
      const name = 'test.PlatformObject'

      const object = new (NitroModules.getHybridClass<typeof PlatformObject>(name))()
      expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(true)
      expect(Object.is(object.constructor.name, 'PlatformObject')).to.equal(true)
    },

    'getHybridClass(\'test.external.SomeExternalObject\') returns an object named "SomeExternalObject"': () => {
      const name = 'test.external.SomeExternalObject'

      const hybridClass = NitroModules.getHybridClass<typeof SomeExternalObject>(name)
      const object = new ExternalBase().createExternalObject()
      expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(true)
      expect(Object.is(object.constructor.name, 'SomeExternalObject')).to.equal(true)
      expect(object).to.be.instanceOf(hybridClass)
      expect(() => Reflect.construct(hybridClass, [])).to.throw('has no public constructor.')
    },

    'getHybridClass(...) returns a class that creates independent instances': () => {
      const hybridClass = NitroModules.getHybridClass<typeof TestObjectSwiftKotlin>('test.TestObjectSwiftKotlin')
      const a = new hybridClass()
      const b = new hybridClass()
      expect(Object.is(a, b)).to.equal(false)
      expect(Object.is(a.equals(b), false)).to.equal(true)
    },
  }),
  ...namedCases('NitroModules type checks', {
    'isHybridObject(...) is false for primitives': () => {
      const results = Object.fromEntries(PRIMITIVES.map(({ label, value }) => [label, NitroModules.isHybridObject(value as object)]))
      expect(results).to.deep.equal({
        'undefined': false,
        'null': false,
        '42': false,
        "'TestObjectCpp'": false,
      })
    },

    'hasNativeState(...) is false for primitives': () => {
      const results = Object.fromEntries(PRIMITIVES.map(({ label, value }) => [label, NitroModules.hasNativeState(value)]))
      expect(results).to.deep.equal({
        'undefined': false,
        'null': false,
        '42': false,
        "'TestObjectCpp'": false,
      })
    },

    'isHybridObject({}) is false': () => {
      expect(Object.is(NitroModules.isHybridObject({}), false)).to.equal(true)
    },

    'hasNativeState({}) is false': () => {
      expect(Object.is(NitroModules.hasNativeState({}), false)).to.equal(true)
    },

    'isHybridObject(a HybridObject prototype) is false': () => {
      expect(Object.is(NitroModules.isHybridObject(Object.getPrototypeOf(HybridSomeExternalObject)), false)).to.equal(true)
    },

    'hasNativeState(a JS ArrayBuffer) is false': () => {
      expect(Object.is(NitroModules.hasNativeState(new ArrayBuffer(8)), false)).to.equal(true)
    },

    'hasNativeState(a native ArrayBuffer) is false': () => {
      const buffer = NitroModules.createNativeArrayBuffer(8)
      // JSI's MutableBuffer owns the native storage without a NativeState.
      expect(buffer).to.be.instanceOf(ArrayBuffer)
      expect(buffer.byteLength).to.equal(8)
      expect(NitroModules.hasNativeState(buffer)).to.equal(false)
    },

    'isHybridObject(a native ArrayBuffer) is false': () => {
      // Native buffer storage does not make the JS ArrayBuffer a HybridObject.
      expect(Object.is(NitroModules.isHybridObject(NitroModules.createNativeArrayBuffer(8)), false)).to.equal(true)
    },
  }),
  ...casesForTestObjects('NitroModules with a HybridObject', {
    'box(testObject) returns a boxed object': (testObject) => {
      const boxed = NitroModules.box(testObject)
      expect(boxed).to.be.a('object')
      expect(boxed.unbox).to.be.a('function')
    },

    'box(testObject).unbox() returns the same object': (testObject) => {
      const boxed = NitroModules.box(testObject)
      expect(Object.is(boxed.unbox(), testObject)).to.equal(true)
    },

    'hasHybridClass(namespace + constructor.name) is true': (testObject) => {
      expect(Object.is(NitroModules.hasHybridClass(`test.${testObject.constructor.name}`), true)).to.equal(true)
    },

    'isHybridObject(testObject) is true': (testObject) => {
      expect(Object.is(NitroModules.isHybridObject(testObject), true)).to.equal(true)
    },

    'hasNativeState(testObject) is true': (testObject) => {
      expect(Object.is(NitroModules.hasNativeState(testObject), true)).to.equal(true)
    },

    'box(testObject) only exposes unbox': (testObject) => {
      expect(Object.keys(NitroModules.box(testObject))).to.deep.equal(['unbox'])
    },

    'box(testObject) is not a HybridObject itself': (testObject) => {
      expect(Object.is(NitroModules.isHybridObject(NitroModules.box(testObject)), false)).to.equal(true)
    },

    'box(newTestObject()).unbox() returns that new object': (testObject) => {
      const other = testObject.newTestObject()
      expect(Object.is(NitroModules.box(other).unbox(), other)).to.equal(true)
    },

    'box({}) throws because it has no NativeState': (testObject) => {
      // @ts-expect-error - a plain object is not a HybridObject
      const boxPlainObject = () => NitroModules.box({})
      expect(boxPlainObject).to.throw('NitroModulesProxy.box(...)')
      expect(boxPlainObject).to.throw('It does not have a NativeState!')
    },

    'updateMemorySize(testObject) returns the same object': (testObject) => {
      expect(Object.is(NitroModules.updateMemorySize(testObject), testObject)).to.equal(true)
    },
  }),
  ...casesForTestObjects('getHybridClass instanceof', {
    'createBase() is an instance of registered Base': (testObject) => {
      const HybridBase = NitroModules.getHybridClass<typeof Base>('test.Base')
      expect(testObject.createBase()).to.be.instanceOf(HybridBase)
    },

    'createBase() is not an instance of Child': (testObject) => {
      const HybridChild = NitroModules.getHybridClass<typeof Child>('test.Child')

      expect(testObject.createBase()).not.to.be.instanceOf(HybridChild)
    },

    'createChild() is an instance of registered Child': (testObject) => {
      const HybridChild = NitroModules.getHybridClass<typeof Child>('test.Child')
      expect(testObject.createChild()).to.be.instanceOf(HybridChild)
    },

    'createChild() is an instance of registered Base': (testObject) => {
      const HybridBase = NitroModules.getHybridClass<typeof Base>('test.Base')
      expect(testObject.createChild()).to.be.instanceOf(HybridBase)
    },

    'createBaseActualChild() is an instance of registered Child': (testObject) => {
      const HybridChild = NitroModules.getHybridClass<typeof Child>('test.Child')
      expect(testObject.createBaseActualChild()).to.be.instanceOf(HybridChild)
    },

    'testObject is not an instance of Base': (testObject) => {
      const HybridBase = NitroModules.getHybridClass<typeof Base>('test.Base')

      expect(testObject).not.to.be.instanceOf(HybridBase)
    },
  }),
  ...namedCases('getHybridClass', {
    'new T() creates a HybridObject': () => {
      const HybridTestObjectCpp = NitroModules.getHybridClass<typeof TestObjectCpp>('test.TestObjectCpp')

      const instance = new HybridTestObjectCpp()
      expect(Object.is(NitroModules.isHybridObject(instance), true)).to.equal(true)
      expect(Object.is(instance.constructor.name, 'TestObjectCpp')).to.equal(true)
      expect(instance).to.have.property('boolValue')
    },

    'new T() is an instance of T': () => {
      const HybridTestObjectCpp = NitroModules.getHybridClass<typeof TestObjectCpp>('test.TestObjectCpp')

      expect(new HybridTestObjectCpp()).to.be.instanceOf(HybridTestObjectCpp)
    },

    '{} is not an instance of T': () => {
      const HybridTestObjectCpp = NitroModules.getHybridClass<typeof TestObjectCpp>('test.TestObjectCpp')

      expect({}).not.to.be.instanceOf(HybridTestObjectCpp)
    },

    'new T() creates a new instance every time': () => {
      const HybridTestObjectCpp = NitroModules.getHybridClass<typeof TestObjectCpp>('test.TestObjectCpp')

      const a = new HybridTestObjectCpp()
      const b = new HybridTestObjectCpp()
      expect(Object.is(a, b)).to.equal(false)
    },

    'new T().equals(itself) is true': () => {
      const HybridTestObjectCpp = NitroModules.getHybridClass<typeof TestObjectCpp>('test.TestObjectCpp')

      const a = new HybridTestObjectCpp()
      expect(Object.is(a.equals(a), true)).to.equal(true)
    },

    'returns the same constructor for the same name': () => {
      const HybridTestObjectCpp = NitroModules.getHybridClass<typeof TestObjectCpp>('test.TestObjectCpp')

      expect(Object.is(NitroModules.getHybridClass<typeof TestObjectCpp>('test.TestObjectCpp'), HybridTestObjectCpp)).to.equal(true)
    },

    'a different HybridObject type is not an instance of T': () => {
      const HybridTestObjectCpp = NitroModules.getHybridClass<typeof TestObjectCpp>('test.TestObjectCpp')

      const HybridTestObjectSwiftKotlin = NitroModules.getHybridClass<typeof TestObjectSwiftKotlin>('test.TestObjectSwiftKotlin')
      expect(new HybridTestObjectSwiftKotlin()).not.to.be.instanceOf(HybridTestObjectCpp)
    },

    'an existing instance is an instance of T': () => {
      expect(HybridSomeExternalObject).to.be.instanceOf(
        NitroModules.getHybridClass<typeof SomeExternalObject>('test.external.SomeExternalObject')
      )
    },

    'getHybridClass throws for an unregistered name': () => {
      expect(() => NitroModules.getHybridClass<typeof Base>(UNKNOWN_NAME)).to.throw(`HybridClass "${UNKNOWN_NAME}" is not registered.`)
    },
  }),
}

export const skips = {
  'NitroModules with a HybridObject / TestObjectCpp / box({}) throws because it has no NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'NitroModules with a HybridObject / TestObjectSwiftKotlin / box({}) throws because it has no NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
} as const
