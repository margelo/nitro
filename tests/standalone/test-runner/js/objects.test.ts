import { expect } from 'chai'
import { casesForTestObjects, namedCases } from './utils/cases'
import { NitroModules } from 'nitro-core'
import { Base, Child, Grandchild, SizeUnit, TestObjectSwiftKotlin, type Size, TestObjectCpp } from 'nitro-test'
import { HybridChild } from './utils/testObjects'
import { TEST_CAR } from './utils/fixtures'

/**
 * Returns the enumerable keys of `object` and its whole prototype chain.
 *
 * The chain is walked on purpose: TestObjectCpp has an extra prototype level
 * (it only owns `rawJsiFunc`), so its spec methods live one level higher than
 * TestObjectSwiftKotlin's. `for...in` collects keys without reading values -
 * reading a native getter with `this = prototype` throws (no NativeState).
 */
function getEnumerableKeys(object: object): string[] {
  const keys: string[] = []
  for (const key in object) {
    keys.push(key)
  }
  return keys
}

/**
 * Walks up the prototype chain of `object` to the HybridObject root prototype
 * (the one that owns `toString`, `equals` and `dispose`). Only checks own keys,
 * so it never reads a native getter.
 */
function findRootPrototype(object: object): object | undefined {
  let prototype: object | null = object
  while (
    prototype != null &&
    !(Object.hasOwn(prototype, 'toString') && Object.hasOwn(prototype, 'equals') && Object.hasOwn(prototype, 'dispose'))
  ) {
    prototype = Object.getPrototypeOf(prototype)
  }
  return prototype ?? undefined
}

/**
 * Returns the property descriptor of {@linkcode key} from {@linkcode object}
 * or the first prototype that owns it, without invoking a getter.
 */
function findPropertyDescriptor(object: object, key: string): PropertyDescriptor | undefined {
  let current: object | null = object
  while (current != null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key)
    if (descriptor != null) return descriptor
    current = Object.getPrototypeOf(current)
  }
  return undefined
}

const TEST_OBJECT_PROPERTIES = ['int64Value', 'uint64Value', 'boolValue', 'stringValue'] as const

const CHILD_TO_STRING = 'HybridChild custom toString() :)'

/**
 * Returns the debug `__type` of every Nitro prototype in the prototype chain of
 * {@linkcode object}, most derived first. Only reads own data properties, so
 * it never invokes a native getter.
 */
function getPrototypeTypes(object: object): unknown[] {
  const types: unknown[] = []
  let prototype: object | null = Object.getPrototypeOf(object)
  while (prototype != null && Object.hasOwn(prototype, '__type')) {
    types.push(Object.getOwnPropertyDescriptor(prototype, '__type')?.value)
    prototype = Object.getPrototypeOf(prototype)
  }
  return types
}

/**
 * Compares prototypes as a boolean so a failure never prints a prototype.
 */
function isSamePrototype(a: object | null, b: object | null): boolean {
  return a === b
}

export function registeredGrandchildConstructor(): void {
  const grandchild = new Grandchild()
  const testObject = new TestObjectSwiftKotlin()
  expect(grandchild.grandchildValue).to.equal(40)
  expect(grandchild).to.be.instanceOf(Grandchild)
  expect(grandchild).to.be.instanceOf(Child)
  expect(grandchild).to.be.instanceOf(Base)
  expect(isSamePrototype(Object.getPrototypeOf(grandchild), Object.getPrototypeOf(testObject.createGrandchild()))).to.equal(true)
  expect(Object.is(testObject.bounceGrandchild(grandchild), grandchild)).to.equal(true)
}

type TestObjectConstructor = typeof TestObjectCpp | typeof TestObjectSwiftKotlin

function staticMethodCases(Constructor: TestObjectConstructor) {
  return {
    'numbers and booleans round-trip': () => {
      expect(Constructor.staticAdd(1.5, 2.25)).to.equal(3.75)
      expect(Constructor.staticAdd(-1, 1)).to.equal(0)
      expect(Constructor.staticAdd(Number.MAX_SAFE_INTEGER, 1)).to.equal(Number.MAX_SAFE_INTEGER + 1)
      expect(Number.isNaN(Constructor.staticAdd(Number.NaN, 1))).to.equal(true)
      expect(Constructor.staticNegate(true)).to.equal(false)
      expect(Constructor.staticNegate(false)).to.equal(true)
    },

    'strings keep every character': () => {
      expect(Constructor.staticConcat('hello ', 'world')).to.equal('hello world')
      expect(Constructor.staticConcat('', '')).to.equal('')
      expect(Constructor.staticConcat('h\u00e9llo ', 'w\u00f6rld \ud83d\ude00')).to.equal('h\u00e9llo w\u00f6rld \ud83d\ude00')
      expect(Constructor.staticConcat('a\u0000b', 'c')).to.equal('a\u0000bc')
    },

    'long and runtime-built strings round-trip': () => {
      const long = 'a'.repeat(300)
      expect(Constructor.staticConcat(long, 'b'.repeat(300))).to.equal(long + 'b'.repeat(300))
      const accented = '\u00e9'.repeat(40)
      expect(Constructor.staticConcat(accented, 'x')).to.equal(accented + 'x')
      // Strings built at runtime can be stored in several pieces.
      const pieces = ['x', 'y', 'z'].join('-') + String(Math.random() >= 0)
      expect(Constructor.staticConcat(pieces, 'q')).to.equal(pieces + 'q')
    },

    'structs round-trip': () => {
      expect(Constructor.staticBouncePoint({ x: 1.5, y: -2, visible: true })).to.deep.equal({ x: 1.5, y: -2, visible: true })
      const withGetter = {
        get x() {
          return 3
        },
        y: 4,
        visible: false,
        extra: 'ignored',
      }
      expect(Constructor.staticBouncePoint(withGetter)).to.deep.equal({ x: 3, y: 4, visible: false })
    },

    'functions work detached and from JavaScript subclasses': () => {
      const add = Constructor.staticAdd
      expect(add(2, 3)).to.equal(5)
      expect(add.call(undefined, 4, 5)).to.equal(9)
      class Subclass extends (Constructor as typeof TestObjectCpp) {}
      expect(Subclass.staticAdd(1, 2)).to.equal(3)
    },

    'functions report their name and arity': () => {
      expect(Constructor.staticAdd.name).to.equal('staticAdd')
      expect(Constructor.staticAdd.length).to.equal(2)
      expect(Constructor.staticBouncePoint.length).to.equal(1)
    },

    'invalid arguments throw': () => {
      // @ts-expect-error - exercise native argument validation.
      expect(() => Constructor.staticAdd('1', 2)).to.throw('staticAdd: ')
      // @ts-expect-error - exercise native argument count validation.
      expect(() => Constructor.staticAdd(1, 2, 3)).to.throw('arguments')
      // @ts-expect-error - exercise native argument count validation.
      expect(() => Constructor.staticAdd(1)).to.throw('arguments')
      // @ts-expect-error - exercise native argument validation.
      expect(() => Constructor.staticNegate(1)).to.throw('staticNegate: ')
      // @ts-expect-error - exercise native argument validation.
      expect(() => Constructor.staticConcat(1, 'b')).to.throw('staticConcat: ')
      // @ts-expect-error - exercise native struct validation.
      expect(() => Constructor.staticBouncePoint({ x: 1, y: 'a', visible: true })).to.throw('staticBouncePoint: ')
      // @ts-expect-error - exercise native struct validation.
      expect(() => Constructor.staticBouncePoint(undefined)).to.throw('staticBouncePoint: ')
    },

    'native errors carry the method name and message': () => {
      expect(() => Constructor.staticThrow('Static methods can throw.')).to.throw('staticThrow: ')
      expect(() => Constructor.staticThrow('Static methods can throw.')).to.throw('Static methods can throw.')
    },
  }
}

function staticPropertyCases(Constructor: TestObjectConstructor) {
  return {
    'readonlyNumber cannot be changed': () => {
      expect(Constructor.readonlyNumber).to.equal(42)
      expect(Reflect.set(Constructor, 'readonlyNumber', 1)).to.equal(false)
      try {
        // @ts-expect-error - the native property is read-only in TypeScript too.
        Constructor.readonlyNumber = 1
      } catch (error) {
        // Strict JavaScript throws; non-strict JavaScript ignores the assignment.
        expect(error).to.be.instanceOf(TypeError)
      }
      expect(Constructor.readonlyNumber).to.equal(42)
    },

    'properties are non-enumerable, non-configurable accessors': () => {
      const readonly = Object.getOwnPropertyDescriptor(Constructor, 'readonlyNumber')
      const writable = Object.getOwnPropertyDescriptor(Constructor, 'sharedNumber')
      for (const descriptor of [readonly, writable]) {
        expect(descriptor).not.to.equal(undefined)
        expect(descriptor?.enumerable).to.equal(false)
        expect(descriptor?.configurable).to.equal(false)
        expect(descriptor?.get).to.be.a('function')
        expect(descriptor?.get?.length).to.equal(0)
        expect(descriptor).not.to.have.property('value')
      }
      expect(readonly?.set).to.equal(undefined)
      expect(writable?.set).to.be.a('function')
      expect(writable?.set?.length).to.equal(1)
    },

    "separate instances share the constructor's property": () => {
      const original = Constructor.sharedNumber
      try {
        const first = new Constructor()
        const second = new Constructor()
        const firstConstructor = first.constructor as TestObjectConstructor
        const secondConstructor = second.constructor as TestObjectConstructor
        expect(Object.is(first, second)).to.equal(false)
        expect('sharedNumber' in first).to.equal(false)
        expect('readonlyNumber' in second).to.equal(false)

        Constructor.sharedNumber = 13
        expect(firstConstructor.sharedNumber).to.equal(13)
        expect(secondConstructor.sharedNumber).to.equal(13)
        firstConstructor.sharedNumber = 29
        expect(Constructor.sharedNumber).to.equal(29)
        expect(secondConstructor.sharedNumber).to.equal(29)
      } finally {
        Constructor.sharedNumber = original
      }
    },

    'JavaScript subclasses inherit the same static storage': () => {
      class Subclass extends (Constructor as typeof TestObjectCpp) {}
      const original = Constructor.sharedNumber
      try {
        expect(Subclass.readonlyNumber).to.equal(42)
        Subclass.sharedNumber = 17
        expect(Constructor.sharedNumber).to.equal(17)
        Constructor.sharedNumber = 31
        expect(Subclass.sharedNumber).to.equal(31)
        expect(Object.hasOwn(Subclass, 'sharedNumber')).to.equal(false)
      } finally {
        Constructor.sharedNumber = original
      }
    },

    'invalid values leave the writable property unchanged': () => {
      const original = Constructor.sharedNumber
      try {
        Constructor.sharedNumber = 23
        expect(() => {
          // @ts-expect-error - exercise native argument validation.
          Constructor.sharedNumber = 'invalid'
        }).to.throw()
        expect(Constructor.sharedNumber).to.equal(23)
      } finally {
        Constructor.sharedNumber = original
      }
    },
  }
}

export const cases = {
  ...casesForTestObjects('HybridObject prototype', {
    'prototype has simpleFunc': (testObject) => {
      const prototype = Object.getPrototypeOf(testObject)
      expect(getEnumerableKeys(prototype)).to.include('simpleFunc')
    },

    'prototype of the prototype has toString and equals': (testObject) => {
      const prototype = Object.getPrototypeOf(Object.getPrototypeOf(testObject))
      // Object.prototype.toString is not enumerable, so this only finds Nitro's.
      expect(getEnumerableKeys(prototype)).to.include.members(['toString', 'equals'])
    },

    'prototype has no NativeState, only the instance has one': (testObject) => {
      expect(Object.is(NitroModules.hasNativeState(testObject), true)).to.equal(true)
      expect(Object.is(NitroModules.hasNativeState(Object.getPrototypeOf(testObject)), false)).to.equal(true)
    },

    'prototype inherits the shared HybridObject root toString': (testObject) => {
      const root = findRootPrototype(NitroModules) as { toString: unknown } | undefined
      expect(root, 'HybridObject root prototype').to.not.equal(undefined)
      // Compared as a boolean so a failure never prints a prototype.
      expect(
        Object.is(Object.getPrototypeOf(testObject).toString === root?.toString, true),
        'prototype.toString === HybridObject root toString'
      ).to.equal(true)
    },
  }),
  ...casesForTestObjects('HybridObject identity', {
    'thisObject returns the same JS object every time': (testObject) => {
      expect(Object.is(testObject.thisObject, testObject.thisObject)).to.equal(true)
    },

    'thisObject returns the instance itself': (testObject) => {
      expect(Object.is(testObject.thisObject, testObject)).to.equal(true)
    },

    'thisObject.equals(thisObject) is true': (testObject) => {
      expect(Object.is(testObject.thisObject.equals(testObject.thisObject), true)).to.equal(true)
    },

    'newTestObject() returns a different JS object every time': (testObject) => {
      expect(Object.is(testObject.newTestObject(), testObject.newTestObject())).to.equal(false)
    },

    'newTestObject().equals(newTestObject()) is false': (testObject) => {
      expect(Object.is(testObject.newTestObject().equals(testObject.newTestObject()), false)).to.equal(true)
    },

    'different instances share the same prototype': (testObject) => {
      const objA = testObject.newTestObject()
      const objB = testObject.newTestObject()
      // Compared as a boolean so a failure never prints the prototypes.
      expect(
        Object.is(Object.getPrototypeOf(objA) === Object.getPrototypeOf(objB), true),
        'Object.getPrototypeOf(objA) === Object.getPrototypeOf(objB)'
      ).to.equal(true)
    },
  }),
  ...casesForTestObjects('HybridObject-returning members', {
    'thisObject returns a HybridObject of the same type': (testObject) => {
      const self = testObject.thisObject
      expect(Object.is(NitroModules.isHybridObject(self), true)).to.equal(true)
      expect(Object.is(self.constructor.name, testObject.constructor.name)).to.equal(true)
      for (const property of TEST_OBJECT_PROPERTIES) {
        expect(self).to.have.property(property).that.is.not.oneOf([null, undefined])
      }
    },

    'newTestObject() returns a HybridObject of the same type': (testObject) => {
      const newObject = testObject.newTestObject()
      expect(Object.is(NitroModules.isHybridObject(newObject), true)).to.equal(true)
      expect(Object.is(newObject.constructor.name, testObject.constructor.name)).to.equal(true)
      for (const property of TEST_OBJECT_PROPERTIES) {
        expect(newObject).to.have.property(property).that.is.not.oneOf([null, undefined])
      }
    },
  }),
  ...casesForTestObjects('HybridObject base members', {
    'toString() returns "[HybridObject <name>]"': (testObject) => {
      expect(Object.is(testObject.toString(), `[HybridObject ${testObject.constructor.name}]`)).to.equal(true)
    },

    'namespace and name identify a registered HybridObject': (testObject) => {
      expect(NitroModules.getAllHybridClassNames()).to.include(`test.${testObject.constructor.name}`)
    },

    'equals(itself) is true': (testObject) => {
      expect(Object.is(testObject.equals(testObject), true)).to.equal(true)
    },

    'equals(thisObject) is true': (testObject) => {
      expect(Object.is(testObject.equals(testObject.thisObject), true)).to.equal(true)
    },

    'equals(newTestObject()) is false': (testObject) => {
      expect(Object.is(testObject.equals(testObject.newTestObject()), false)).to.equal(true)
    },

    'Object.keys(...) only lists the debug __type key': (testObject) => {
      // All members live on the prototype - in debug, Nitro adds `__type`.
      expect(Object.keys(testObject)).to.deep.equal(NitroModules.buildType === 'debug' ? ['__type'] : [])
    },
  }),
  ...casesForTestObjects('HybridObject members', {
    'addNumbers.length is its parameter count': (testObject) => {
      expect(Object.is(testObject.addNumbers.length, 2)).to.equal(true)
    },

    'addNumbers.name is the method name': (testObject) => {
      expect(Object.is(testObject.addNumbers.name, 'addNumbers')).to.equal(true)
    },

    'methods are enumerable, read-only and not configurable': (testObject) => {
      const descriptor = findPropertyDescriptor(testObject, 'addNumbers')
      expect(descriptor?.value).to.be.a('function')
      expect(descriptor).to.deep.include({
        value: descriptor?.value,
        enumerable: true,
        writable: false,
        configurable: false,
      })
    },

    'readonly properties only have a getter': (testObject) => {
      const descriptor = findPropertyDescriptor(testObject, 'thisObject')
      expect(descriptor?.get).to.be.a('function')
      expect(descriptor).to.deep.include({
        get: descriptor?.get,
        set: undefined,
        enumerable: true,
        configurable: false,
      })
    },

    'writable properties have a getter and a setter': (testObject) => {
      const descriptor = findPropertyDescriptor(testObject, 'numberValue')
      expect(descriptor?.get).to.be.a('function')
      expect(descriptor?.set).to.be.a('function')
      expect(descriptor).to.deep.include({
        get: descriptor?.get,
        set: descriptor?.set,
        enumerable: true,
        configurable: false,
      })
    },

    'property getters read the instance bound to `this`': (testObject) => {
      const other = testObject.newTestObject()
      other.numberValue = 42
      testObject.numberValue = 13
      const getter = findPropertyDescriptor(testObject, 'numberValue')?.get
      expect(Object.is(getter?.call(other), 42)).to.equal(true)
    },

    '__type is "HybridObject<name>" in debug': (testObject) => {
      expect(Object.is(testObject.__type, `HybridObject<${testObject.constructor.name}>`)).to.equal(true)
    },

    'prototype is frozen in debug': (testObject) => {
      expect(Object.is(Object.isFrozen(Object.getPrototypeOf(testObject)), true)).to.equal(true)
    },
  }),
  ...casesForTestObjects('HybridObject `this` binding', {
    'a destructured method throws because `this` is unbound': (testObject) => {
      const { addNumbers } = testObject
      expect(() => addNumbers(2, 3)).to.throw('`this` is not bound!')
    },

    'a method called on the prototype throws': (testObject) => {
      const prototype = Object.getPrototypeOf(testObject) as {
        addNumbers: (a: number, b: number) => number
      }
      expect(() => prototype.addNumbers(2, 3)).to.throw('`this` does not have a NativeState!')
    },

    'a method called on another HybridObject type throws': (testObject) => {
      const base = testObject.createBase()
      expect(() => testObject.addNumbers.call(base, 2, 3)).to.throw("`this` has a NativeState, but it's the wrong type!")
    },
  }),
  ...casesForTestObjects('HybridObject equals()', {
    'equals(a HybridObject of another type) is false': (testObject) => {
      expect(Object.is(testObject.equals(testObject.createBase()), false)).to.equal(true)
    },

    'equals({}) throws because it has no NativeState': (testObject) => {
      // @ts-expect-error - a plain object is not a HybridObject
      const equalsPlainObject = () => testObject.equals({})
      expect(equalsPlainObject).to.throw(`${testObject.constructor.name}.equals(...)`)
      expect(equalsPlainObject).to.throw('It does not have a NativeState!')
    },

    'equals(undefined) throws': (testObject) => {
      // @ts-expect-error - undefined is not a HybridObject
      expect(() => testObject.equals(undefined)).to.throw('It is undefined!')
    },
  }),
  ...casesForTestObjects('HybridObject dispose()', {
    'dispose() returns undefined': (testObject) => {
      expect(testObject.newTestObject().dispose()).to.equal(undefined)
    },

    'dispose() makes isHybridObject(...) false': (testObject) => {
      const object = testObject.newTestObject()
      object.dispose()
      expect(Object.is(NitroModules.isHybridObject(object), false)).to.equal(true)
    },

    'dispose() leaves other instances usable': (testObject) => {
      const object = testObject.newTestObject()
      const other = testObject.newTestObject()
      object.dispose()
      expect(Object.is(other.addNumbers(2, 3), 5)).to.equal(true)
    },

    'a method call after dispose() throws': (testObject) => {
      const object = testObject.newTestObject()
      object.dispose()
      const addNumbers = () => object.addNumbers(2, 3)
      expect(addNumbers).to.throw(/Cannot call hybrid function `\w+\.addNumbers\(\.\.\.\)`/)
      expect(addNumbers).to.throw('dispose()')
    },

    'a property read after dispose() throws': (testObject) => {
      const object = testObject.newTestObject()
      object.dispose()
      const getNumberValue = () => object.numberValue
      expect(getNumberValue).to.throw(/Cannot get hybrid property `\w+\.numberValue`/)
      expect(getNumberValue).to.throw('dispose()')
    },

    'a property write after dispose() throws': (testObject) => {
      const object = testObject.newTestObject()
      object.dispose()
      const setNumberValue = () => {
        object.numberValue = 5
      }
      expect(setNumberValue).to.throw(/Cannot set hybrid property `\w+\.numberValue`/)
      expect(setNumberValue).to.throw('dispose()')
    },

    'constructor and class name remain available after dispose()': (testObject) => {
      const object = testObject.newTestObject()
      const constructor = object.constructor
      object.dispose()
      expect(object.constructor).to.equal(constructor)
      expect(object.constructor.name).to.equal(testObject.constructor.name)
    },

    'toString() after dispose() throws': (testObject) => {
      const object = testObject.newTestObject()
      object.dispose()
      expect(() => object.toString()).to.throw('Cannot call hybrid function `HybridObject.toString(...)`')
    },

    'dispose() twice throws': (testObject) => {
      const object = testObject.newTestObject()
      object.dispose()
      expect(() => object.dispose()).to.throw('Cannot call hybrid function `HybridObject.dispose(...)`')
    },

    'a native reference re-wraps a disposed object in a new JS object': (testObject) => {
      const holder = testObject.newTestObject()
      const object = testObject.newTestObject()
      object.numberValue = 42
      holder.optionalHybrid = object
      object.dispose()
      // The native instance is still alive (held by `holder`), but the disposed
      // JS object dropped its NativeState, so native creates a new JS object.
      const rewrapped = holder.optionalHybrid
      expect(Object.is(rewrapped, object)).to.equal(false)
      expect(Object.is(rewrapped?.numberValue, 42)).to.equal(true)
    },
  }),
  ...casesForTestObjects('HybridObject identity in containers', {
    'bounceHybridObjects(...) keeps the JS identity of every element': (testObject) => {
      const childA = testObject.createChild()
      const childB = testObject.createChild()
      const result = testObject.bounceHybridObjects([childA, childB, childA])
      expect(result).to.have.length(3)
      expect(Object.is(result[0], childA)).to.equal(true)
      expect(Object.is(result[1], childB)).to.equal(true)
      expect(Object.is(result[2], childA)).to.equal(true)
    },
  }),
  ...namedCases('Three-level Swift inheritance', {
    'constructors and prototypes preserve every declared level': () => {
      const grandchild = new Grandchild()
      expect(Object.is(grandchild.constructor, Grandchild)).to.equal(true)
      expect(Object.is(Object.getPrototypeOf(grandchild), Grandchild.prototype)).to.equal(true)
      expect(Object.is(Object.getPrototypeOf(Grandchild.prototype), Child.prototype)).to.equal(true)
      expect(Object.is(Object.getPrototypeOf(Child.prototype), Base.prototype)).to.equal(true)
      expect(Object.is(Object.getPrototypeOf(Grandchild), Child)).to.equal(true)
      expect(Object.is(Object.getPrototypeOf(Child), Base)).to.equal(true)
    },

    'borrowed ancestor getters dispatch to the Grandchild implementation': () => {
      const grandchild = new Grandchild()
      const getBaseValue = Object.getOwnPropertyDescriptor(Base.prototype, 'baseValue')?.get
      const getChildValue = Object.getOwnPropertyDescriptor(Child.prototype, 'childValue')?.get
      expect(getBaseValue).to.be.a('function')
      expect(getChildValue).to.be.a('function')
      expect(getBaseValue!.call(grandchild)).to.equal(20)
      expect(getChildValue!.call(grandchild)).to.equal(30)
    },

    'borrowed ancestor methods accept Grandchild receivers': async () => {
      const grandchild = new Grandchild()
      const size: Size = { width: 20, height: 30, unit: SizeUnit.Points }
      expect(Base.prototype.bounceSize.call(grandchild, size)).to.deep.equal(size)
      expect(Child.prototype.bounceVariant.call(grandchild, TEST_CAR)).to.deep.equal(TEST_CAR)
      let calls = 0
      expect(
        await Base.prototype.mapSize.call(grandchild, size, (value) => {
          calls += 1
          return value
        })
      ).to.deep.equal(size)
      expect(calls).to.equal(1)
    },
  }),
  ...casesForTestObjects('Inheritance', {
    'createBase() returns a Base': (testObject) => {
      const base = testObject.createBase()
      expect(Object.is(NitroModules.isHybridObject(base), true)).to.equal(true)
      expect(base).to.have.property('baseValue', 10)
      expect(base).not.to.have.property('childValue')
    },

    'createChild() returns a Child with Base members': (testObject) => {
      const child = testObject.createChild()
      expect(Object.is(NitroModules.isHybridObject(child), true)).to.equal(true)
      expect(child).to.have.property('childValue', 30)
      expect(child).to.have.property('baseValue', 20)
    },

    'createGrandchild() returns a Grandchild with Child and Base members': (testObject) => {
      const grandchild = testObject.createGrandchild()
      expect(NitroModules.isHybridObject(grandchild)).to.equal(true)
      expect(grandchild.constructor.name).to.equal('Grandchild')
      expect(grandchild.grandchildValue).to.equal(40)
      expect(grandchild.childValue).to.equal(30)
      expect(grandchild.baseValue).to.equal(20)
    },

    'createChildActualGrandchild() preserves the Grandchild type': (testObject) => {
      const child = testObject.createChildActualGrandchild()
      expect(child.constructor.name).to.equal('Grandchild')
      expect(child).to.have.property('grandchildValue', 40)
      // @ts-expect-error - typed as a Child, but it is actually a Grandchild
      expect(Object.is(testObject.bounceGrandchild(child), child)).to.equal(true)
    },

    'createBaseActualGrandchild() preserves the Grandchild type': (testObject) => {
      const base = testObject.createBaseActualGrandchild()
      expect(base.constructor.name).to.equal('Grandchild')
      expect(base).to.have.property('grandchildValue', 40)
      expect(base).to.have.property('childValue', 30)
      // @ts-expect-error - typed as a Base, but it is actually a Grandchild
      expect(Object.is(testObject.bounceGrandchild(base), base)).to.equal(true)
    },

    'createBase() has name "Base"': (testObject) => {
      expect(Object.is(testObject.createBase().constructor.name, 'Base')).to.equal(true)
    },

    'createChild() has name "Child"': (testObject) => {
      expect(Object.is(testObject.createChild().constructor.name, 'Child')).to.equal(true)
    },

    'createChild() has overridden toString()': (testObject) => {
      expect(Object.is(testObject.createChild().toString(), CHILD_TO_STRING)).to.equal(true)
    },

    'createBaseActualChild() has overridden toString()': (testObject) => {
      expect(Object.is(testObject.createBaseActualChild().toString(), CHILD_TO_STRING)).to.equal(true)
    },

    'createBaseActualChild() has name "Child"': (testObject) => {
      expect(Object.is(testObject.createBaseActualChild().constructor.name, 'Child')).to.equal(true)
    },

    'createBaseActualChild() returns a Base': (testObject) => {
      const base = testObject.createBaseActualChild()
      expect(Object.is(NitroModules.isHybridObject(base), true)).to.equal(true)
      expect(base).to.have.property('baseValue', 20)
    },

    'createBaseActualChild() is actually a Child': (testObject) => {
      const base = testObject.createBaseActualChild()
      expect(base).to.have.property('childValue', 30)
      expect(base).to.have.property('baseValue', 20)
    },
  }),
  ...casesForTestObjects('Inheritance casts', {
    'bounceChild(Child) returns the same Child': (testObject) => {
      const child = testObject.createChild()
      expect(Object.is(testObject.bounceChild(child), child)).to.equal(true)
    },

    'bounceBase(Base) returns the same Base': (testObject) => {
      const base = testObject.createBase()
      expect(Object.is(testObject.bounceBase(base), base)).to.equal(true)
    },

    'bounceBase(Child) returns the same Child': (testObject) => {
      const child = testObject.createChild()
      expect(Object.is(testObject.bounceBase(child), child)).to.equal(true)
    },

    'Grandchild roundtrips through Grandchild, Child and Base': (testObject) => {
      const grandchild = testObject.createGrandchild()
      expect(Object.is(testObject.bounceGrandchild(grandchild), grandchild)).to.equal(true)
      expect(Object.is(testObject.bounceChild(grandchild), grandchild)).to.equal(true)
      expect(Object.is(testObject.bounceBase(grandchild), grandchild)).to.equal(true)
      expect(Object.is(testObject.bounceChildBase(grandchild), grandchild)).to.equal(true)
      expect(Object.is(testObject.castBase(grandchild), grandchild)).to.equal(true)
    },

    // In release, the downcast check is optimized away and this would crash.

    'bounceChild(Base) throws': (testObject) => {
      const base = testObject.createBase()
      // @ts-expect-error - a Base is not a Child
      const bounceBaseAsChild = () => testObject.bounceChild(base)
      expect(bounceBaseAsChild).to.throw(`${testObject.constructor.name}.bounceChild(...)`)
      expect(bounceBaseAsChild).to.throw('Downcasting failed - It has a different NativeState<T>!')
    },

    'bounceChildBase(Child) returns the same Child': (testObject) => {
      const child = testObject.createChild()
      expect(Object.is(testObject.bounceChildBase(child), child)).to.equal(true)
    },

    'castBase(Child) returns the same Child': (testObject) => {
      const child = testObject.createChild()
      expect(Object.is(testObject.castBase(child), child)).to.equal(true)
    },

    'castBase(createBaseActualChild()) returns the same object': (testObject) => {
      const base = testObject.createBaseActualChild()
      expect(Object.is(testObject.castBase(base), base)).to.equal(true)
    },

    'castBase(registered Child) returns the same object': (testObject) => {
      expect(Object.is(testObject.castBase(HybridChild), HybridChild)).to.equal(true)
    },

    'bounceBase(createBaseActualChild()) returns the same object': (testObject) => {
      const base = testObject.createBaseActualChild()
      expect(Object.is(testObject.bounceBase(base), base)).to.equal(true)
    },

    'bounceChild(createBaseActualChild()) accepts the actual Child': (testObject) => {
      const base = testObject.createBaseActualChild()
      // @ts-expect-error - typed as a Base, but it is actually a Child
      expect(Object.is(testObject.bounceChild(base), base)).to.equal(true)
    },

    'bounceChildBase(Base) throws': (testObject) => {
      const base = testObject.createBase()
      // @ts-expect-error - a Base is not a Child
      const bounceBaseAsChild = () => testObject.bounceChildBase(base)
      expect(bounceBaseAsChild).to.throw(`${testObject.constructor.name}.bounceChildBase(...)`)
      expect(bounceBaseAsChild).to.throw('Downcasting failed - It has a different NativeState<T>!')
    },

    'bounceBase(another HybridObject type) throws': (testObject) => {
      // @ts-expect-error - a TestObject is not a Base
      expect(() => testObject.bounceBase(testObject)).to.throw('Downcasting failed - It has a different NativeState<T>!')
    },

    'bounceBase({}) throws because it has no NativeState': (testObject) => {
      // @ts-expect-error - a plain object is not a Base
      expect(() => testObject.bounceBase({})).to.throw('It does not have a NativeState!')
    },
  }),
  ...casesForTestObjects('Inheritance members', {
    'createBase() has the default toString()': (testObject) => {
      expect(Object.is(testObject.createBase().toString(), '[HybridObject Base]')).to.equal(true)
    },

    'createBase() does not have Child methods': (testObject) => {
      expect(testObject.createBase()).not.to.have.property('bounceVariant')
    },

    'createChild() is not equal to another Child': (testObject) => {
      expect(Object.is(testObject.createChild().equals(testObject.createChild()), false)).to.equal(true)
    },

    'createGrandchild() inherits Child and Base methods': async (testObject) => {
      const grandchild = testObject.createGrandchild()
      const size = { width: 12, height: 34, unit: SizeUnit.Points }
      expect(grandchild.toString()).to.equal(CHILD_TO_STRING)
      expect(grandchild.bounceVariant('grandchild')).to.equal('grandchild')
      expect(grandchild.bounceSize(size)).to.deep.equal(size)
      expect(grandchild.bounceSizeUnit(SizeUnit.Pixels)).to.equal(SizeUnit.Pixels)
      expect(await grandchild.mapSize(size, (value) => ({ ...value, width: value.width * 2 }))).to.deep.equal({
        ...size,
        width: 24,
      })
    },

    'Base and Child do not have Grandchild members': (testObject) => {
      expect(testObject.createBase()).not.to.have.property('grandchildValue')
      expect(testObject.createChild()).not.to.have.property('grandchildValue')
    },
  }),
  ...casesForTestObjects('Inheritance prototypes', {
    'createGrandchild() prototype extends Child and Base': (testObject) => {
      const grandchild = testObject.createGrandchild()
      const child = testObject.createChild()
      const base = testObject.createBase()
      const grandchildPrototype = Object.getPrototypeOf(grandchild)
      const childPrototype = Object.getPrototypeOf(child)
      const basePrototype = Object.getPrototypeOf(base)
      expect(isSamePrototype(Object.getPrototypeOf(grandchildPrototype), childPrototype)).to.equal(true)
      expect(isSamePrototype(Object.getPrototypeOf(childPrototype), basePrototype)).to.equal(true)
      expect(grandchild).to.be.instanceOf(grandchild.constructor)
      expect(grandchild).to.be.instanceOf(child.constructor)
      expect(grandchild).to.be.instanceOf(base.constructor)
      expect(isSamePrototype(grandchildPrototype, Object.getPrototypeOf(testObject.createGrandchild()))).to.equal(true)
      expect(isSamePrototype(grandchildPrototype, Object.getPrototypeOf(testObject.createChildActualGrandchild()))).to.equal(true)
      expect(isSamePrototype(grandchildPrototype, Object.getPrototypeOf(testObject.createBaseActualGrandchild()))).to.equal(true)
    },

    'createChild() prototype extends the createBase() prototype': (testObject) => {
      const childPrototype = Object.getPrototypeOf(testObject.createChild())
      const basePrototype = Object.getPrototypeOf(testObject.createBase())
      expect(
        Object.is(isSamePrototype(Object.getPrototypeOf(childPrototype), basePrototype), true),
        'Object.getPrototypeOf(childPrototype) === basePrototype'
      ).to.equal(true)
    },

    'createBaseActualChild() has the Child prototype': (testObject) => {
      expect(
        Object.is(
          isSamePrototype(Object.getPrototypeOf(testObject.createBaseActualChild()), Object.getPrototypeOf(testObject.createChild())),
          true
        ),
        'Object.getPrototypeOf(actualChild) === Object.getPrototypeOf(child)'
      ).to.equal(true)
    },

    "createChild() reuses its implementation's constructor and prototype": (testObject) => {
      const child = testObject.createChild()
      const anotherChild = testObject.createChild()
      const base = testObject.createBase()
      expect(child.constructor).to.equal(anotherChild.constructor)
      expect(isSamePrototype(Object.getPrototypeOf(child), Object.getPrototypeOf(anotherChild))).to.equal(true)
      expect(child).to.be.instanceOf(child.constructor)
      expect(child).to.be.instanceOf(base.constructor)
    },

    'createChild() shares the registered Child prototype': (testObject) => {
      expect(
        isSamePrototype(Object.getPrototypeOf(testObject.createChild()), Object.getPrototypeOf(HybridChild)),
        'Object.getPrototypeOf(child) === Object.getPrototypeOf(HybridChild)'
      ).to.equal(true)
    },

    'createChild() prototype chain is Child, Base, HybridObject': (testObject) => {
      expect(getPrototypeTypes(testObject.createChild())).to.deep.equal(['Prototype<Child>', 'Prototype<Base>', 'Prototype<HybridObject>'])
    },

    'createBase() prototype chain is Base, HybridObject': (testObject) => {
      expect(getPrototypeTypes(testObject.createBase())).to.deep.equal(['Prototype<Base>', 'Prototype<HybridObject>'])
    },
  }),
  ...namedCases('Static properties / TestObjectCpp', staticPropertyCases(TestObjectCpp)),
  ...namedCases('Static properties / TestObjectSwiftKotlin', staticPropertyCases(TestObjectSwiftKotlin)),
  ...namedCases('Static methods / TestObjectCpp', staticMethodCases(TestObjectCpp)),
  ...namedCases('Static methods / TestObjectSwiftKotlin', staticMethodCases(TestObjectSwiftKotlin)),
}

export const skips = {
  'HybridObject members / TestObjectCpp / __type is "HybridObject<name>" in debug': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject members / TestObjectSwiftKotlin / __type is "HybridObject<name>" in debug': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject members / TestObjectCpp / prototype is frozen in debug': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject members / TestObjectSwiftKotlin / prototype is frozen in debug': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject `this` binding / TestObjectCpp / a destructured method throws because `this` is unbound': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject `this` binding / TestObjectSwiftKotlin / a destructured method throws because `this` is unbound': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject `this` binding / TestObjectCpp / a method called on the prototype throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject `this` binding / TestObjectSwiftKotlin / a method called on the prototype throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject `this` binding / TestObjectCpp / a method called on another HybridObject type throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject `this` binding / TestObjectSwiftKotlin / a method called on another HybridObject type throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject equals() / TestObjectCpp / equals({}) throws because it has no NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject equals() / TestObjectSwiftKotlin / equals({}) throws because it has no NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject equals() / TestObjectCpp / equals(undefined) throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject equals() / TestObjectSwiftKotlin / equals(undefined) throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectCpp / a method call after dispose() throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectSwiftKotlin / a method call after dispose() throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectCpp / a property read after dispose() throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectSwiftKotlin / a property read after dispose() throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectCpp / a property write after dispose() throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectSwiftKotlin / a property write after dispose() throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectCpp / toString() after dispose() throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectSwiftKotlin / toString() after dispose() throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectCpp / dispose() twice throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'HybridObject dispose() / TestObjectSwiftKotlin / dispose() twice throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance casts / TestObjectCpp / bounceChild(Base) throws': {
    release: "Existing main exclusion: NitroModules.buildType === 'debug'",
  },
  'Inheritance casts / TestObjectSwiftKotlin / bounceChild(Base) throws': {
    release: "Existing main exclusion: NitroModules.buildType === 'debug'",
  },
  'Inheritance casts / TestObjectCpp / bounceChildBase(Base) throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance casts / TestObjectSwiftKotlin / bounceChildBase(Base) throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance casts / TestObjectCpp / bounceBase(another HybridObject type) throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance casts / TestObjectSwiftKotlin / bounceBase(another HybridObject type) throws': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance casts / TestObjectCpp / bounceBase({}) throws because it has no NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance casts / TestObjectSwiftKotlin / bounceBase({}) throws because it has no NativeState': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance prototypes / TestObjectCpp / createChild() prototype chain is Child, Base, HybridObject': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance prototypes / TestObjectSwiftKotlin / createChild() prototype chain is Child, Base, HybridObject': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance prototypes / TestObjectCpp / createBase() prototype chain is Base, HybridObject': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'Inheritance prototypes / TestObjectSwiftKotlin / createBase() prototype chain is Base, HybridObject': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
} as const
