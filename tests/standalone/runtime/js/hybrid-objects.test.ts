import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

import { getNitroModules } from "nitro-core";

const NitroModules = getNitroModules();

/**
 * Returns the enumerable keys of `object` and its whole prototype chain.
 *
 * The chain is walked on purpose: TestObjectCpp has an extra prototype level
 * (it only owns `rawJsiFunc`), so its spec methods live one level higher than
 * TestObjectSwiftKotlin's. `for...in` collects keys without reading values -
 * reading a native getter with `this = prototype` throws (no NativeState).
 */
function getEnumerableKeys(object: object): string[] {
  const keys: string[] = [];
  for (const key in object) {
    keys.push(key);
  }
  return keys;
}

/**
 * Walks up the prototype chain of `object` to the HybridObject root prototype
 * (the one that owns `toString`, `equals` and `dispose`). Only checks own keys,
 * so it never reads a native getter.
 */
function findRootPrototype(object: object): object | undefined {
  let prototype: object | null = object;
  while (
    prototype != null &&
    !(
      Object.hasOwn(prototype, "toString") &&
      Object.hasOwn(prototype, "equals") &&
      Object.hasOwn(prototype, "dispose")
    )
  ) {
    prototype = Object.getPrototypeOf(prototype);
  }
  return prototype ?? undefined;
}

/**
 * Returns the property descriptor of {@linkcode key} from {@linkcode object}
 * or the first prototype that owns it, without invoking a getter.
 */
function findPropertyDescriptor(
  object: object,
  key: string,
): PropertyDescriptor | undefined {
  let current: object | null = object;
  while (current != null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor != null) return descriptor;
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}

const TEST_OBJECT_PROPERTIES = [
  "int64Value",
  "uint64Value",
  "boolValue",
  "stringValue",
] as const;

export const cases = {
  ...casesForTestObjects("HybridObject prototype", {
    "prototype has simpleFunc": (testObject) => {
      const prototype = Object.getPrototypeOf(testObject);
      expect(getEnumerableKeys(prototype)).to.include("simpleFunc");
    },

    "prototype of the prototype has toString and equals": (testObject) => {
      const prototype = Object.getPrototypeOf(
        Object.getPrototypeOf(testObject),
      );
      // Object.prototype.toString is not enumerable, so this only finds Nitro's.
      expect(getEnumerableKeys(prototype)).to.include.members([
        "toString",
        "equals",
      ]);
    },

    "prototype has no NativeState, only the instance has one": (testObject) => {
      expect(Object.is(NitroModules.hasNativeState(testObject), true)).to.equal(
        true,
      );
      expect(
        Object.is(
          NitroModules.hasNativeState(Object.getPrototypeOf(testObject)),
          false,
        ),
      ).to.equal(true);
    },

    "prototype inherits the shared HybridObject root toString": (
      testObject,
    ) => {
      const root = findRootPrototype(NitroModules) as
        | { toString: unknown }
        | undefined;
      expect(root, "HybridObject root prototype").to.not.equal(undefined);
      // Compared as a boolean so a failure never prints a prototype.
      expect(
        Object.is(
          Object.getPrototypeOf(testObject).toString === root?.toString,
          true,
        ),
        "prototype.toString === HybridObject root toString",
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("HybridObject identity", {
    "thisObject returns the same JS object every time": (testObject) => {
      expect(Object.is(testObject.thisObject, testObject.thisObject)).to.equal(
        true,
      );
    },

    "thisObject returns the instance itself": (testObject) => {
      expect(Object.is(testObject.thisObject, testObject)).to.equal(true);
    },

    "thisObject.equals(thisObject) is true": (testObject) => {
      expect(
        Object.is(testObject.thisObject.equals(testObject.thisObject), true),
      ).to.equal(true);
    },

    "newTestObject() returns a different JS object every time": (
      testObject,
    ) => {
      expect(
        Object.is(testObject.newTestObject(), testObject.newTestObject()),
      ).to.equal(false);
    },

    "newTestObject().equals(newTestObject()) is false": (testObject) => {
      expect(
        Object.is(
          testObject.newTestObject().equals(testObject.newTestObject()),
          false,
        ),
      ).to.equal(true);
    },

    "different instances share the same prototype": (testObject) => {
      const objA = testObject.newTestObject();
      const objB = testObject.newTestObject();
      // Compared as a boolean so a failure never prints the prototypes.
      expect(
        Object.is(
          Object.getPrototypeOf(objA) === Object.getPrototypeOf(objB),
          true,
        ),
        "Object.getPrototypeOf(objA) === Object.getPrototypeOf(objB)",
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("HybridObject-returning members", {
    "thisObject returns a HybridObject of the same type": (testObject) => {
      const self = testObject.thisObject;
      expect(Object.is(NitroModules.isHybridObject(self), true)).to.equal(true);
      expect(Object.is(self.name, testObject.name)).to.equal(true);
      for (const property of TEST_OBJECT_PROPERTIES) {
        expect(self)
          .to.have.property(property)
          .that.is.not.oneOf([null, undefined]);
      }
    },

    "newTestObject() returns a HybridObject of the same type": (testObject) => {
      const newObject = testObject.newTestObject();
      expect(Object.is(NitroModules.isHybridObject(newObject), true)).to.equal(
        true,
      );
      expect(Object.is(newObject.name, testObject.name)).to.equal(true);
      for (const property of TEST_OBJECT_PROPERTIES) {
        expect(newObject)
          .to.have.property(property)
          .that.is.not.oneOf([null, undefined]);
      }
    },
  }),
  ...casesForTestObjects("HybridObject base members", {
    'toString() returns "[HybridObject <name>]"': (testObject) => {
      expect(
        Object.is(testObject.toString(), `[HybridObject ${testObject.name}]`),
      ).to.equal(true);
    },

    "name is a registered HybridObject name": (testObject) => {
      expect(NitroModules.getAllHybridObjectNames()).to.include(
        testObject.name,
      );
    },

    "equals(itself) is true": (testObject) => {
      expect(Object.is(testObject.equals(testObject), true)).to.equal(true);
    },

    "equals(thisObject) is true": (testObject) => {
      expect(
        Object.is(testObject.equals(testObject.thisObject), true),
      ).to.equal(true);
    },

    "equals(newTestObject()) is false": (testObject) => {
      expect(
        Object.is(testObject.equals(testObject.newTestObject()), false),
      ).to.equal(true);
    },

    "Object.keys(...) only lists the debug __type key": (testObject) => {
      // All members live on the prototype - in debug, Nitro adds `__type`.
      expect(Object.keys(testObject)).to.deep.equal(
        NitroModules.buildType === "debug" ? ["__type"] : [],
      );
    },
  }),
  ...casesForTestObjects("HybridObject members", {
    "addNumbers.length is its parameter count": (testObject) => {
      expect(Object.is(testObject.addNumbers.length, 2)).to.equal(true);
    },

    "addNumbers.name is the method name": (testObject) => {
      expect(Object.is(testObject.addNumbers.name, "addNumbers")).to.equal(
        true,
      );
    },

    "methods are enumerable, read-only and not configurable": (testObject) => {
      const descriptor = findPropertyDescriptor(testObject, "addNumbers");
      expect(descriptor?.value).to.be.a("function");
      expect(descriptor).to.deep.include({
        value: descriptor?.value,
        enumerable: true,
        writable: false,
        configurable: false,
      });
    },

    "readonly properties only have a getter": (testObject) => {
      const descriptor = findPropertyDescriptor(testObject, "thisObject");
      expect(descriptor?.get).to.be.a("function");
      expect(descriptor).to.deep.include({
        get: descriptor?.get,
        set: undefined,
        enumerable: true,
        configurable: false,
      });
    },

    "writable properties have a getter and a setter": (testObject) => {
      const descriptor = findPropertyDescriptor(testObject, "numberValue");
      expect(descriptor?.get).to.be.a("function");
      expect(descriptor?.set).to.be.a("function");
      expect(descriptor).to.deep.include({
        get: descriptor?.get,
        set: descriptor?.set,
        enumerable: true,
        configurable: false,
      });
    },

    "property getters read the instance bound to `this`": (testObject) => {
      const other = testObject.newTestObject();
      other.numberValue = 42;
      testObject.numberValue = 13;
      const getter = findPropertyDescriptor(testObject, "numberValue")?.get;
      expect(Object.is(getter?.call(other), 42)).to.equal(true);
    },

    '__type is "HybridObject<name>" in debug': (testObject) => {
      expect(
        Object.is(testObject.__type, `HybridObject<${testObject.name}>`),
      ).to.equal(true);
    },

    "prototype is frozen in debug": (testObject) => {
      expect(
        Object.is(Object.isFrozen(Object.getPrototypeOf(testObject)), true),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("HybridObject `this` binding", {
    "a destructured method throws because `this` is unbound": (testObject) => {
      const { addNumbers } = testObject;
      expect(() => addNumbers(2, 3)).to.throw("`this` is not bound!");
    },

    "a method called on the prototype throws": (testObject) => {
      const prototype = Object.getPrototypeOf(testObject) as {
        addNumbers: (a: number, b: number) => number;
      };
      expect(() => prototype.addNumbers(2, 3)).to.throw(
        "`this` does not have a NativeState!",
      );
    },

    "a method called on another HybridObject type throws": (testObject) => {
      const base = testObject.createBase();
      expect(() => testObject.addNumbers.call(base, 2, 3)).to.throw(
        "`this` has a NativeState, but it's the wrong type!",
      );
    },
  }),
  ...casesForTestObjects("HybridObject equals()", {
    "equals(a HybridObject of another type) is false": (testObject) => {
      expect(
        Object.is(testObject.equals(testObject.createBase()), false),
      ).to.equal(true);
    },

    "equals({}) throws because it has no NativeState": (testObject) => {
      // @ts-expect-error - a plain object is not a HybridObject
      const equalsPlainObject = () => testObject.equals({});
      expect(equalsPlainObject).to.throw(`${testObject.name}.equals(...)`);
      expect(equalsPlainObject).to.throw("It does not have a NativeState!");
    },

    "equals(undefined) throws": (testObject) => {
      // @ts-expect-error - undefined is not a HybridObject
      expect(() => testObject.equals(undefined)).to.throw("It is undefined!");
    },
  }),
  ...casesForTestObjects("HybridObject dispose()", {
    "dispose() returns undefined": (testObject) => {
      expect(testObject.newTestObject().dispose()).to.equal(undefined);
    },

    "dispose() makes isHybridObject(...) false": (testObject) => {
      const object = testObject.newTestObject();
      object.dispose();
      expect(Object.is(NitroModules.isHybridObject(object), false)).to.equal(
        true,
      );
    },

    "dispose() leaves other instances usable": (testObject) => {
      const object = testObject.newTestObject();
      const other = testObject.newTestObject();
      object.dispose();
      expect(Object.is(other.addNumbers(2, 3), 5)).to.equal(true);
    },

    "a method call after dispose() throws": (testObject) => {
      const object = testObject.newTestObject();
      object.dispose();
      const addNumbers = () => object.addNumbers(2, 3);
      expect(addNumbers).to.throw(
        /Cannot call hybrid function `\w+\.addNumbers\(\.\.\.\)`/,
      );
      expect(addNumbers).to.throw("dispose()");
    },

    "a property read after dispose() throws": (testObject) => {
      const object = testObject.newTestObject();
      object.dispose();
      const getNumberValue = () => object.numberValue;
      expect(getNumberValue).to.throw(
        /Cannot get hybrid property `\w+\.numberValue`/,
      );
      expect(getNumberValue).to.throw("dispose()");
    },

    "a property write after dispose() throws": (testObject) => {
      const object = testObject.newTestObject();
      object.dispose();
      const setNumberValue = () => {
        object.numberValue = 5;
      };
      expect(setNumberValue).to.throw(
        /Cannot set hybrid property `\w+\.numberValue`/,
      );
      expect(setNumberValue).to.throw("dispose()");
    },

    "name after dispose() throws": (testObject) => {
      const object = testObject.newTestObject();
      object.dispose();
      expect(() => object.name).to.throw(
        "Cannot get hybrid property `HybridObject.name`",
      );
    },

    "toString() after dispose() throws": (testObject) => {
      const object = testObject.newTestObject();
      object.dispose();
      expect(() => object.toString()).to.throw(
        "Cannot call hybrid function `HybridObject.toString(...)`",
      );
    },

    "dispose() twice throws": (testObject) => {
      const object = testObject.newTestObject();
      object.dispose();
      expect(() => object.dispose()).to.throw(
        "Cannot call hybrid function `HybridObject.dispose(...)`",
      );
    },

    "a native reference re-wraps a disposed object in a new JS object": (
      testObject,
    ) => {
      const holder = testObject.newTestObject();
      const object = testObject.newTestObject();
      object.numberValue = 42;
      holder.optionalHybrid = object;
      object.dispose();
      // The native instance is still alive (held by `holder`), but the disposed
      // JS object dropped its NativeState, so native creates a new JS object.
      const rewrapped = holder.optionalHybrid;
      expect(Object.is(rewrapped, object)).to.equal(false);
      expect(Object.is(rewrapped?.numberValue, 42)).to.equal(true);
    },
  }),
  ...casesForTestObjects("HybridObject identity in containers", {
    "bounceHybridObjects(...) keeps the JS identity of every element": (
      testObject,
    ) => {
      const childA = testObject.createChild();
      const childB = testObject.createChild();
      const result = testObject.bounceHybridObjects([childA, childB, childA]);
      expect(result).to.have.length(3);
      expect(Object.is(result[0], childA)).to.equal(true);
      expect(Object.is(result[1], childB)).to.equal(true);
      expect(Object.is(result[2], childA)).to.equal(true);
    },
  }),
};

export const skips = {
  'HybridObject members / TestObjectCpp / __type is "HybridObject<name>" in debug':
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  'HybridObject members / TestObjectSwiftKotlin / __type is "HybridObject<name>" in debug':
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject members / TestObjectCpp / prototype is frozen in debug": {
    release: "Existing main exclusion: IS_DEBUG",
  },
  "HybridObject members / TestObjectSwiftKotlin / prototype is frozen in debug":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject `this` binding / TestObjectCpp / a destructured method throws because `this` is unbound":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject `this` binding / TestObjectSwiftKotlin / a destructured method throws because `this` is unbound":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject `this` binding / TestObjectCpp / a method called on the prototype throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject `this` binding / TestObjectSwiftKotlin / a method called on the prototype throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject `this` binding / TestObjectCpp / a method called on another HybridObject type throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject `this` binding / TestObjectSwiftKotlin / a method called on another HybridObject type throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject equals() / TestObjectCpp / equals({}) throws because it has no NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject equals() / TestObjectSwiftKotlin / equals({}) throws because it has no NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject equals() / TestObjectCpp / equals(undefined) throws": {
    release: "Existing main exclusion: IS_DEBUG",
  },
  "HybridObject equals() / TestObjectSwiftKotlin / equals(undefined) throws": {
    release: "Existing main exclusion: IS_DEBUG",
  },
  "HybridObject dispose() / TestObjectCpp / a method call after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectSwiftKotlin / a method call after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectCpp / a property read after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectSwiftKotlin / a property read after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectCpp / a property write after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectSwiftKotlin / a property write after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectCpp / name after dispose() throws": {
    release: "Existing main exclusion: IS_DEBUG",
  },
  "HybridObject dispose() / TestObjectSwiftKotlin / name after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectCpp / toString() after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectSwiftKotlin / toString() after dispose() throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "HybridObject dispose() / TestObjectCpp / dispose() twice throws": {
    release: "Existing main exclusion: IS_DEBUG",
  },
  "HybridObject dispose() / TestObjectSwiftKotlin / dispose() twice throws": {
    release: "Existing main exclusion: IS_DEBUG",
  },
} as const;
