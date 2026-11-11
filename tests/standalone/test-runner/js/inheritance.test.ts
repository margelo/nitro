import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

import { getNitroModules } from "nitro-core";
import { HybridChild } from "./utils/testObjects";

const NitroModules = getNitroModules();

const CHILD_TO_STRING = "HybridChild custom toString() :)";

/**
 * Returns the debug `__type` of every Nitro prototype in the prototype chain of
 * {@linkcode object}, most derived first. Only reads own data properties, so
 * it never invokes a native getter.
 */
function getPrototypeTypes(object: object): unknown[] {
  const types: unknown[] = [];
  let prototype: object | null = Object.getPrototypeOf(object);
  while (prototype != null && Object.hasOwn(prototype, "__type")) {
    types.push(Object.getOwnPropertyDescriptor(prototype, "__type")?.value);
    prototype = Object.getPrototypeOf(prototype);
  }
  return types;
}

/**
 * Compares prototypes as a boolean so a failure never prints a prototype.
 */
function isSamePrototype(a: object | null, b: object | null): boolean {
  return a === b;
}

export const cases = {
  ...casesForTestObjects("Inheritance", {
    "createBase() returns a Base": (testObject) => {
      const base = testObject.createBase();
      expect(Object.is(NitroModules.isHybridObject(base), true)).to.equal(true);
      expect(base).to.have.property("baseValue", 10);
      expect(base).not.to.have.property("childValue");
    },

    "createChild() returns a Child with Base members": (testObject) => {
      const child = testObject.createChild();
      expect(Object.is(NitroModules.isHybridObject(child), true)).to.equal(
        true,
      );
      expect(child).to.have.property("childValue", 30);
      expect(child).to.have.property("baseValue", 20);
    },

    'createBase() has name "Base"': (testObject) => {
      expect(Object.is(testObject.createBase().name, "Base")).to.equal(true);
    },

    'createChild() has name "Child"': (testObject) => {
      expect(Object.is(testObject.createChild().name, "Child")).to.equal(true);
    },

    "createChild() has overridden toString()": (testObject) => {
      expect(
        Object.is(testObject.createChild().toString(), CHILD_TO_STRING),
      ).to.equal(true);
    },

    "createBaseActualChild() has overridden toString()": (testObject) => {
      expect(
        Object.is(
          testObject.createBaseActualChild().toString(),
          CHILD_TO_STRING,
        ),
      ).to.equal(true);
    },

    'createBaseActualChild() has name "Child"': (testObject) => {
      expect(
        Object.is(testObject.createBaseActualChild().name, "Child"),
      ).to.equal(true);
    },

    "createBaseActualChild() returns a Base": (testObject) => {
      const base = testObject.createBaseActualChild();
      expect(Object.is(NitroModules.isHybridObject(base), true)).to.equal(true);
      expect(base).to.have.property("baseValue", 20);
    },

    "createBaseActualChild() is actually a Child": (testObject) => {
      const base = testObject.createBaseActualChild();
      expect(base).to.have.property("childValue", 30);
      expect(base).to.have.property("baseValue", 20);
    },
  }),
  ...casesForTestObjects("Inheritance casts", {
    "bounceChild(Child) returns the same Child": (testObject) => {
      const child = testObject.createChild();
      expect(Object.is(testObject.bounceChild(child), child)).to.equal(true);
    },

    "bounceBase(Base) returns the same Base": (testObject) => {
      const base = testObject.createBase();
      expect(Object.is(testObject.bounceBase(base), base)).to.equal(true);
    },

    "bounceBase(Child) returns the same Child": (testObject) => {
      const child = testObject.createChild();
      expect(Object.is(testObject.bounceBase(child), child)).to.equal(true);
    },

    // In release, the downcast check is optimized away and this would crash.

    "bounceChild(Base) throws": (testObject) => {
      const base = testObject.createBase();
      // @ts-expect-error - a Base is not a Child
      const bounceBaseAsChild = () => testObject.bounceChild(base);
      expect(bounceBaseAsChild).to.throw(`${testObject.name}.bounceChild(...)`);
      expect(bounceBaseAsChild).to.throw(
        "Downcasting failed - It has a different NativeState<T>!",
      );
    },

    "bounceChildBase(Child) returns the same Child": (testObject) => {
      const child = testObject.createChild();
      expect(Object.is(testObject.bounceChildBase(child), child)).to.equal(
        true,
      );
    },

    "castBase(Child) returns the same Child": (testObject) => {
      const child = testObject.createChild();
      expect(Object.is(testObject.castBase(child), child)).to.equal(true);
    },

    "castBase(createBaseActualChild()) returns the same object": (
      testObject,
    ) => {
      const base = testObject.createBaseActualChild();
      expect(Object.is(testObject.castBase(base), base)).to.equal(true);
    },

    "castBase(registered Child) returns the same object": (testObject) => {
      expect(Object.is(testObject.castBase(HybridChild), HybridChild)).to.equal(
        true,
      );
    },

    "bounceBase(createBaseActualChild()) returns the same object": (
      testObject,
    ) => {
      const base = testObject.createBaseActualChild();
      expect(Object.is(testObject.bounceBase(base), base)).to.equal(true);
    },

    "bounceChild(createBaseActualChild()) accepts the actual Child": (
      testObject,
    ) => {
      const base = testObject.createBaseActualChild();
      // @ts-expect-error - typed as a Base, but it is actually a Child
      expect(Object.is(testObject.bounceChild(base), base)).to.equal(true);
    },

    "bounceChildBase(Base) throws": (testObject) => {
      const base = testObject.createBase();
      // @ts-expect-error - a Base is not a Child
      const bounceBaseAsChild = () => testObject.bounceChildBase(base);
      expect(bounceBaseAsChild).to.throw(
        `${testObject.name}.bounceChildBase(...)`,
      );
      expect(bounceBaseAsChild).to.throw(
        "Downcasting failed - It has a different NativeState<T>!",
      );
    },

    "bounceBase(another HybridObject type) throws": (testObject) => {
      // @ts-expect-error - a TestObject is not a Base
      expect(() => testObject.bounceBase(testObject)).to.throw(
        "Downcasting failed - It has a different NativeState<T>!",
      );
    },

    "bounceBase({}) throws because it has no NativeState": (testObject) => {
      // @ts-expect-error - a plain object is not a Base
      expect(() => testObject.bounceBase({})).to.throw(
        "It does not have a NativeState!",
      );
    },
  }),
  ...casesForTestObjects("Inheritance members", {
    "createBase() has the default toString()": (testObject) => {
      expect(
        Object.is(testObject.createBase().toString(), "[HybridObject Base]"),
      ).to.equal(true);
    },

    "createBase() does not have Child methods": (testObject) => {
      expect(testObject.createBase()).not.to.have.property("bounceVariant");
    },

    "createChild() is not equal to another Child": (testObject) => {
      expect(
        Object.is(
          testObject.createChild().equals(testObject.createChild()),
          false,
        ),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("Inheritance prototypes", {
    "createChild() prototype extends the createBase() prototype": (
      testObject,
    ) => {
      const childPrototype = Object.getPrototypeOf(testObject.createChild());
      const basePrototype = Object.getPrototypeOf(testObject.createBase());
      expect(
        Object.is(
          isSamePrototype(Object.getPrototypeOf(childPrototype), basePrototype),
          true,
        ),
        "Object.getPrototypeOf(childPrototype) === basePrototype",
      ).to.equal(true);
    },

    "createBaseActualChild() has the Child prototype": (testObject) => {
      expect(
        Object.is(
          isSamePrototype(
            Object.getPrototypeOf(testObject.createBaseActualChild()),
            Object.getPrototypeOf(testObject.createChild()),
          ),
          true,
        ),
        "Object.getPrototypeOf(actualChild) === Object.getPrototypeOf(child)",
      ).to.equal(true);
    },

    "createChild() shares the prototype of the registered Child": (
      testObject,
    ) => {
      expect(
        Object.is(
          isSamePrototype(
            Object.getPrototypeOf(testObject.createChild()),
            Object.getPrototypeOf(HybridChild),
          ),
          true,
        ),
        "Object.getPrototypeOf(child) === Object.getPrototypeOf(HybridChild)",
      ).to.equal(true);
    },

    "createChild() prototype chain is Child, Base, HybridObject": (
      testObject,
    ) => {
      expect(getPrototypeTypes(testObject.createChild())).to.deep.equal([
        "Prototype<HybridChildSpec>",
        "Prototype<HybridBaseSpec>",
        "Prototype<HybridObject>",
      ]);
    },

    "createBase() prototype chain is Base, HybridObject": (testObject) => {
      expect(getPrototypeTypes(testObject.createBase())).to.deep.equal([
        "Prototype<HybridBaseSpec>",
        "Prototype<HybridObject>",
      ]);
    },
  }),
};

export const skips = {
  "Inheritance casts / TestObjectCpp / bounceChild(Base) throws": {
    release: "Existing main exclusion: NitroModules.buildType === 'debug'",
  },
  "Inheritance casts / TestObjectSwiftKotlin / bounceChild(Base) throws": {
    release: "Existing main exclusion: NitroModules.buildType === 'debug'",
  },
  "Inheritance casts / TestObjectCpp / bounceChildBase(Base) throws": {
    release: "Existing main exclusion: IS_DEBUG",
  },
  "Inheritance casts / TestObjectSwiftKotlin / bounceChildBase(Base) throws": {
    release: "Existing main exclusion: IS_DEBUG",
  },
  "Inheritance casts / TestObjectCpp / bounceBase(another HybridObject type) throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "Inheritance casts / TestObjectSwiftKotlin / bounceBase(another HybridObject type) throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "Inheritance casts / TestObjectCpp / bounceBase({}) throws because it has no NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "Inheritance casts / TestObjectSwiftKotlin / bounceBase({}) throws because it has no NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "Inheritance prototypes / TestObjectCpp / createChild() prototype chain is Child, Base, HybridObject":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "Inheritance prototypes / TestObjectSwiftKotlin / createChild() prototype chain is Child, Base, HybridObject":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "Inheritance prototypes / TestObjectCpp / createBase() prototype chain is Base, HybridObject":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "Inheritance prototypes / TestObjectSwiftKotlin / createBase() prototype chain is Base, HybridObject":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
} as const;
