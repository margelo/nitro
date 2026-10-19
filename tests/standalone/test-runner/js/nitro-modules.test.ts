import { casesForTestObjects, namedCases } from "./utils/cases";

import { expect } from "chai";

import { getHybridObjectConstructor, getNitroModules } from "nitro-core";
import nitroModulesPackage from "nitro-core/package.json";

import type { Base } from "nitro-test";
import type { Child } from "nitro-test";
import type { PlatformObject } from "nitro-test";

import {
  type TestObjectCpp,
  type TestObjectSwiftKotlin,
} from "nitro-test";
import { HybridSomeExternalObject } from "./utils/testObjects";

const NitroModules = getNitroModules();

const UNKNOWN_NAME = "SomeUnregisteredHybridObject";

// Every autolinked non-view HybridObject. Views are left out because they
// create platform views, which must happen on the UI Thread.
const REGISTERED_NAMES = [
  "TestObjectCpp",
  "TestObjectSwiftKotlin",
  "Base",
  "Child",
  "PlatformObject",
  "SomeExternalObject",
];

const PRIMITIVES: { label: string; value: unknown }[] = [
  { label: "undefined", value: undefined },
  { label: "null", value: null },
  { label: "42", value: 42 },
  { label: "'TestObjectCpp'", value: "TestObjectCpp" },
];

export const cases = {
  ...namedCases("PlatformObject", {
    "getOSVersion() returns a nonempty OS version string": () => {
      const platform =
        NitroModules.createHybridObject<PlatformObject>("PlatformObject");
      expect(platform.getOSVersion()).to.be.a("string").and.not.be.empty;
    },
  }),
  ...namedCases("NitroModules", {
    "createNativeArrayBuffer(...) returns a writable ArrayBuffer": () => {
      const buffer = NitroModules.createNativeArrayBuffer(1024);
      expect(buffer).to.be.instanceOf(ArrayBuffer);
      expect(Object.is(buffer.byteLength, 1024)).to.equal(true);

      const array = new Uint8Array(buffer);
      array[0] = 13;
      expect(Object.is(array[0], 13)).to.equal(true);
    },

    "buildType is debug or release": () => {
      expect(NitroModules.buildType).to.be.oneOf(["debug", "release"]);
    },

    "version is a semver string": () => {
      expect(NitroModules.version).to.be.a("string");
      expect(NitroModules.version).to.match(/^\d+\.\d+\.\d+/);
    },

    "getAllHybridObjectNames() returns every autolinked HybridObject": () => {
      const names = NitroModules.getAllHybridObjectNames();
      expect(names).to.be.instanceOf(Array);
      expect(names).to.include.members([
        "TestObjectCpp",
        "TestObjectSwiftKotlin",
        "Base",
        "Child",
        "PlatformObject",
        "SomeExternalObject",
      ]);
    },

    "version matches the nitro-core JS package": () => {
      expect(
        Object.is(NitroModules.version, nitroModulesPackage.version),
      ).to.equal(true);
    },

    'name is "NitroModulesProxy"': () => {
      expect(Object.is(NitroModules.name, "NitroModulesProxy")).to.equal(true);
    },

    'toString() is "[HybridObject NitroModulesProxy]"': () => {
      expect(
        Object.is(NitroModules.toString(), "[HybridObject NitroModulesProxy]"),
      ).to.equal(true);
    },

    "isHybridObject(NitroModules) is true": () => {
      expect(
        Object.is(NitroModules.isHybridObject(NitroModules), true),
      ).to.equal(true);
    },

    "createNativeArrayBuffer(0) has a byteLength of 0": () => {
      const size = [0, 1, 4097, 16 * 1024 * 1024][0]!;

      expect(
        Object.is(NitroModules.createNativeArrayBuffer(size).byteLength, size),
      ).to.equal(true);
    },

    "createNativeArrayBuffer(1) has a byteLength of 1": () => {
      const size = [0, 1, 4097, 16 * 1024 * 1024][1]!;

      expect(
        Object.is(NitroModules.createNativeArrayBuffer(size).byteLength, size),
      ).to.equal(true);
    },

    "createNativeArrayBuffer(4097) has a byteLength of 4097": () => {
      const size = [0, 1, 4097, 16 * 1024 * 1024][2]!;

      expect(
        Object.is(NitroModules.createNativeArrayBuffer(size).byteLength, size),
      ).to.equal(true);
    },

    "createNativeArrayBuffer(16777216) has a byteLength of 16777216": () => {
      const size = [0, 1, 4097, 16 * 1024 * 1024][3]!;

      expect(
        Object.is(NitroModules.createNativeArrayBuffer(size).byteLength, size),
      ).to.equal(true);
    },

    "createNativeArrayBuffer(...) returns independent memory every call":
      () => {
        const a = new Uint8Array(NitroModules.createNativeArrayBuffer(8));
        const b = new Uint8Array(NitroModules.createNativeArrayBuffer(8));
        a[0] = 1;
        b[0] = 2;
        expect([a[0], b[0]]).to.deep.equal([1, 2]);
      },
  }),
  ...namedCases("NitroModules registry", {
    "hasHybridObject(unknown name) is false": () => {
      expect(
        Object.is(NitroModules.hasHybridObject(UNKNOWN_NAME), false),
      ).to.equal(true);
    },

    "hasHybridObject(...) is case-sensitive": () => {
      expect(
        Object.is(NitroModules.hasHybridObject("testobjectcpp"), false),
      ).to.equal(true);
    },

    "getAllHybridObjectNames() has no duplicates": () => {
      const names = NitroModules.getAllHybridObjectNames();
      expect(names).to.deep.equal([...new Set(names)]);
    },

    "hasHybridObject(...) is true for every getAllHybridObjectNames() entry":
      () => {
        const missing = NitroModules.getAllHybridObjectNames().filter(
          (name) => !NitroModules.hasHybridObject(name),
        );
        expect(missing).to.deep.equal([]);
      },

    "createHybridObject(unknown name) throws a not-registered error": () => {
      const create = () => NitroModules.createHybridObject(UNKNOWN_NAME);
      expect(create).to.throw("NitroModulesProxy.createHybridObject(...)");
      expect(create).to.throw(
        `Cannot create an instance of HybridObject "${UNKNOWN_NAME}" - It has not yet been registered in the Nitro Modules HybridObjectRegistry!`,
      );
    },

    "createHybridObject(unknown name) error lists the registered names": () => {
      expect(() => NitroModules.createHybridObject(UNKNOWN_NAME)).to.throw(
        /All registered HybridObjects: \[[^\]]*\bTestObjectCpp\b[^\]]*\]/,
      );
    },

    "createHybridObject('TestObjectCpp') returns an object named \"TestObjectCpp\"":
      () => {
        const name = REGISTERED_NAMES[0]!;

        const object = NitroModules.createHybridObject(name);
        expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(
          true,
        );
        expect(Object.is(object.name, name)).to.equal(true);
      },

    "createHybridObject('TestObjectSwiftKotlin') returns an object named \"TestObjectSwiftKotlin\"":
      () => {
        const name = REGISTERED_NAMES[1]!;

        const object = NitroModules.createHybridObject(name);
        expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(
          true,
        );
        expect(Object.is(object.name, name)).to.equal(true);
      },

    "createHybridObject('Base') returns an object named \"Base\"": () => {
      const name = REGISTERED_NAMES[2]!;

      const object = NitroModules.createHybridObject(name);
      expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(
        true,
      );
      expect(Object.is(object.name, name)).to.equal(true);
    },

    "createHybridObject('Child') returns an object named \"Child\"": () => {
      const name = REGISTERED_NAMES[3]!;

      const object = NitroModules.createHybridObject(name);
      expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(
        true,
      );
      expect(Object.is(object.name, name)).to.equal(true);
    },

    "createHybridObject('PlatformObject') returns an object named \"PlatformObject\"":
      () => {
        const name = REGISTERED_NAMES[4]!;

        const object = NitroModules.createHybridObject(name);
        expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(
          true,
        );
        expect(Object.is(object.name, name)).to.equal(true);
      },

    "createHybridObject('SomeExternalObject') returns an object named \"SomeExternalObject\"":
      () => {
        const name = REGISTERED_NAMES[5]!;

        const object = NitroModules.createHybridObject(name);
        expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(
          true,
        );
        expect(Object.is(object.name, name)).to.equal(true);
      },

    "createHybridObject(...) returns a new instance every call": () => {
      const a = NitroModules.createHybridObject("Base");
      const b = NitroModules.createHybridObject("Base");
      expect(Object.is(a, b)).to.equal(false);
      expect(Object.is(a.equals(b), false)).to.equal(true);
    },
  }),
  ...namedCases("NitroModules type checks", {
    "isHybridObject(...) is false for primitives": () => {
      const results = Object.fromEntries(
        PRIMITIVES.map(({ label, value }) => [
          label,
          NitroModules.isHybridObject(value as object),
        ]),
      );
      expect(results).to.deep.equal({
        undefined: false,
        null: false,
        "42": false,
        "'TestObjectCpp'": false,
      });
    },

    "hasNativeState(...) is false for primitives": () => {
      const results = Object.fromEntries(
        PRIMITIVES.map(({ label, value }) => [
          label,
          NitroModules.hasNativeState(value),
        ]),
      );
      expect(results).to.deep.equal({
        undefined: false,
        null: false,
        "42": false,
        "'TestObjectCpp'": false,
      });
    },

    "isHybridObject({}) is false": () => {
      expect(Object.is(NitroModules.isHybridObject({}), false)).to.equal(true);
    },

    "hasNativeState({}) is false": () => {
      expect(Object.is(NitroModules.hasNativeState({}), false)).to.equal(true);
    },

    "isHybridObject(a HybridObject prototype) is false": () => {
      expect(
        Object.is(
          NitroModules.isHybridObject(
            Object.getPrototypeOf(HybridSomeExternalObject),
          ),
          false,
        ),
      ).to.equal(true);
    },

    "hasNativeState(a JS ArrayBuffer) is false": () => {
      expect(
        Object.is(NitroModules.hasNativeState(new ArrayBuffer(8)), false),
      ).to.equal(true);
    },

    "hasNativeState(a native ArrayBuffer) is true": () => {
      expect(
        Object.is(
          NitroModules.hasNativeState(NitroModules.createNativeArrayBuffer(8)),
          true,
        ),
      ).to.equal(true);
    },

    "isHybridObject(a native ArrayBuffer) is false": () => {
      // It has a NativeState, but not a HybridObject one.
      expect(
        Object.is(
          NitroModules.isHybridObject(NitroModules.createNativeArrayBuffer(8)),
          false,
        ),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("NitroModules with a HybridObject", {
    "box(testObject) returns a boxed object": (testObject) => {
      const boxed = NitroModules.box(testObject);
      expect(boxed).to.be.a("object");
      expect(boxed.unbox).to.be.a("function");
    },

    "box(testObject).unbox() returns the same object": (testObject) => {
      const boxed = NitroModules.box(testObject);
      expect(Object.is(boxed.unbox(), testObject)).to.equal(true);
    },

    "hasHybridObject(testObject.name) is true": (testObject) => {
      expect(
        Object.is(NitroModules.hasHybridObject(testObject.name), true),
      ).to.equal(true);
    },

    "isHybridObject(testObject) is true": (testObject) => {
      expect(Object.is(NitroModules.isHybridObject(testObject), true)).to.equal(
        true,
      );
    },

    "hasNativeState(testObject) is true": (testObject) => {
      expect(Object.is(NitroModules.hasNativeState(testObject), true)).to.equal(
        true,
      );
    },

    "box(testObject) only exposes unbox": (testObject) => {
      expect(Object.keys(NitroModules.box(testObject))).to.deep.equal([
        "unbox",
      ]);
    },

    "box(testObject) is not a HybridObject itself": (testObject) => {
      expect(
        Object.is(
          NitroModules.isHybridObject(NitroModules.box(testObject)),
          false,
        ),
      ).to.equal(true);
    },

    "box(newTestObject()).unbox() returns that new object": (testObject) => {
      const other = testObject.newTestObject();
      expect(Object.is(NitroModules.box(other).unbox(), other)).to.equal(true);
    },

    "box({}) throws because it has no NativeState": (testObject) => {
      // @ts-expect-error - a plain object is not a HybridObject
      const boxPlainObject = () => NitroModules.box({});
      expect(boxPlainObject).to.throw("NitroModulesProxy.box(...)");
      expect(boxPlainObject).to.throw("It does not have a NativeState!");
    },

    "updateMemorySize(testObject) returns the same object": (testObject) => {
      expect(
        Object.is(NitroModules.updateMemorySize(testObject), testObject),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("getHybridObjectConstructor instanceof", {
    "createBase() is an instance of Base": (testObject) => {
      const HybridBase = getHybridObjectConstructor<Base>("Base");

      expect(testObject.createBase()).to.be.instanceOf(HybridBase);
    },

    "createBase() is not an instance of Child": (testObject) => {
      const HybridChild = getHybridObjectConstructor<Child>("Child");

      expect(testObject.createBase()).not.to.be.instanceOf(HybridChild);
    },

    "createChild() is an instance of Child": (testObject) => {
      const HybridChild = getHybridObjectConstructor<Child>("Child");

      expect(testObject.createChild()).to.be.instanceOf(HybridChild);
    },

    "createChild() is an instance of Base": (testObject) => {
      const HybridBase = getHybridObjectConstructor<Base>("Base");

      expect(testObject.createChild()).to.be.instanceOf(HybridBase);
    },

    "createBaseActualChild() is an instance of Child": (testObject) => {
      const HybridChild = getHybridObjectConstructor<Child>("Child");

      expect(testObject.createBaseActualChild()).to.be.instanceOf(HybridChild);
    },

    "testObject is not an instance of Base": (testObject) => {
      const HybridBase = getHybridObjectConstructor<Base>("Base");

      expect(testObject).not.to.be.instanceOf(HybridBase);
    },
  }),
  ...namedCases("getHybridObjectConstructor", {
    "new T() creates a HybridObject": () => {
      const HybridTestObjectCpp =
        getHybridObjectConstructor<TestObjectCpp>("TestObjectCpp");

      const instance = new HybridTestObjectCpp();
      expect(Object.is(NitroModules.isHybridObject(instance), true)).to.equal(
        true,
      );
      expect(Object.is(instance.name, "TestObjectCpp")).to.equal(true);
      expect(instance).to.have.property("boolValue");
    },

    "new T() is an instance of T": () => {
      const HybridTestObjectCpp =
        getHybridObjectConstructor<TestObjectCpp>("TestObjectCpp");

      expect(new HybridTestObjectCpp()).to.be.instanceOf(HybridTestObjectCpp);
    },

    "{} is not an instance of T": () => {
      const HybridTestObjectCpp =
        getHybridObjectConstructor<TestObjectCpp>("TestObjectCpp");

      expect({}).not.to.be.instanceOf(HybridTestObjectCpp);
    },

    "new T() creates a new instance every time": () => {
      const HybridTestObjectCpp =
        getHybridObjectConstructor<TestObjectCpp>("TestObjectCpp");

      const a = new HybridTestObjectCpp();
      const b = new HybridTestObjectCpp();
      expect(Object.is(a, b)).to.equal(false);
    },

    "new T().equals(itself) is true": () => {
      const HybridTestObjectCpp =
        getHybridObjectConstructor<TestObjectCpp>("TestObjectCpp");

      const a = new HybridTestObjectCpp();
      expect(Object.is(a.equals(a), true)).to.equal(true);
    },

    "returns the same constructor for the same name": () => {
      const HybridTestObjectCpp =
        getHybridObjectConstructor<TestObjectCpp>("TestObjectCpp");

      expect(
        Object.is(
          getHybridObjectConstructor<TestObjectCpp>("TestObjectCpp"),
          HybridTestObjectCpp,
        ),
      ).to.equal(true);
    },

    "a different HybridObject type is not an instance of T": () => {
      const HybridTestObjectCpp =
        getHybridObjectConstructor<TestObjectCpp>("TestObjectCpp");

      const HybridTestObjectSwiftKotlin =
        getHybridObjectConstructor<TestObjectSwiftKotlin>(
          "TestObjectSwiftKotlin",
        );
      expect(new HybridTestObjectSwiftKotlin()).not.to.be.instanceOf(
        HybridTestObjectCpp,
      );
    },

    "an existing instance is an instance of T": () => {
      expect(HybridSomeExternalObject).to.be.instanceOf(
        getHybridObjectConstructor("SomeExternalObject"),
      );
    },

    "new T() throws for an unregistered name": () => {
      const HybridUnknown = getHybridObjectConstructor(UNKNOWN_NAME);
      expect(() => new HybridUnknown()).to.throw(
        `Cannot create an instance of HybridObject "${UNKNOWN_NAME}"`,
      );
    },
  }),
};

export const skips = {
  "NitroModules with a HybridObject / TestObjectCpp / box({}) throws because it has no NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "NitroModules with a HybridObject / TestObjectSwiftKotlin / box({}) throws because it has no NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
} as const;
