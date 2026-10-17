import { expect } from "chai";
import { namedCases } from "./utils/cases";

import { getNitroModules } from "nitro-core";
import type { Base } from "../specs/Base.nitro";
import type { Child } from "../specs/Child.nitro";
import {
  type Powertrain,
  type TestObjectCpp,
  type TestObjectSwiftKotlin,
} from "../specs/TestObject.nitro";
import { HybridSomeExternalObject } from "./utils/testObjects";

import { TEST_CUSTOM_TYPE, TEST_PERSON } from "./utils/fixtures";
import { debugOnly } from "./utils/helpers";

const NitroModules = getNitroModules();

// `rawJsiFunc` is registered as a raw JSI method in `HybridTestObjectCpp.hpp`,
// so it is not part of the `TestObjectCpp` spec.
interface WithRawJsiFunc {
  rawJsiFunc(...args: unknown[]): unknown;
}

const POWERTRAINS: Powertrain[] = ["electric", "gas", "hybrid"];

export const cases = {
  ...namedCases("C++ only / TestObjectCpp", {
    "getVariantTuple(...) converts Float2": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(testObject.getVariantTuple([10, 20])).to.deep.equal([10, 20]);
    },

    "getVariantTuple(...) converts Float3": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(testObject.getVariantTuple([10, 20, 30])).to.deep.equal([
        10, 20, 30,
      ]);
    },

    "getVariantTuple(...) throws at wrong size (5 items)": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple([10, 20, 30, 40, 50]),
      ).to.throw(`${testObject.name}.getVariantTuple(...): Cannot convert`);
    },

    "getVariantTuple(...) throws at wrong type (string)": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      // @ts-expect-error
      expect(() => testObject.getVariantTuple("hello")).to.throw(
        `${testObject.name}.getVariantTuple(...): Cannot convert`,
      );
    },

    "getVariantTuple(...) throws at wrong type (string[])": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple(["hello", "world"]),
      ).to.throw(`${testObject.name}.getVariantTuple(...): Cannot convert`);
    },

    "someTuple roundtrips [55, 'hello']": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      testObject.someTuple = [55, "hello"];
      expect(testObject.someTuple).to.deep.equal([55, "hello"]);
    },

    "flip([10, 20, 30]) reverses the tuple": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(testObject.flip([10, 20, 30])).to.deep.equal([30, 20, 10]);
    },

    "flip([10, 20]) throws at wrong size": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const flipTwoItems = () =>
        testObject.flip(
          // @ts-expect-error
          [10, 20],
        );
      expect(flipTwoItems).to.throw(
        `${testObject.name}.flip(...): The given JS Array has 2 items, but ${debugOnly("std::tuple<double, double, double>")}`,
      );
      expect(flipTwoItems).to.throw("expects 3 items");
    },

    "passTuple(...) returns the same tuple": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(testObject.passTuple([13, "hello", true])).to.deep.equal([
        13,
        "hello",
        true,
      ]);
    },

    "bounceCustomType(...) returns the same value": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(
        Object.is(
          testObject.bounceCustomType(TEST_CUSTOM_TYPE),
          TEST_CUSTOM_TYPE,
        ),
      ).to.equal(true);
    },

    "bounceAnyHybrid(...) returns the same object": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(
        Object.is(
          testObject.bounceAnyHybrid(HybridSomeExternalObject),
          HybridSomeExternalObject,
        ),
      ).to.equal(true);
    },

    "bounceAnyHybrid(...) result does not equal a different object": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const external = testObject.bounceAnyHybrid(HybridSomeExternalObject);
      expect(Object.is(external.equals(testObject), false)).to.equal(true);
    },

    "rawJsiFunc(...) returns its arguments as an array": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc;

      const result = rawObject.rawJsiFunc(55, false, "hello", { obj: true });
      expect(result).to.deep.equal([55, false, "hello", { obj: true }]);
    },

    "getVariantHybridEnum(...) bounces a HybridObject": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(
        Object.is(testObject.getVariantHybridEnum(testObject), testObject),
      ).to.equal(true);
    },

    "getVariantHybridEnum(...) bounces every Powertrain": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      for (const powertrain of POWERTRAINS) {
        expect(
          Object.is(testObject.getVariantHybridEnum(powertrain), powertrain),
          powertrain,
        ).to.equal(true);
      }
    },

    "getVariantHybridEnum(...) throws for an unknown string": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum("diesel"),
      ).to.throw(
        `${testObject.name}.getVariantHybridEnum(...): Cannot convert "diesel" to any type in ${debugOnly("variant<std::shared_ptr<margelo::nitro::test::HybridTestObjectCppSpec>, margelo::nitro::test::Powertrain>!")}`,
      );
    },

    "getVariantHybridEnum(...) throws for a TestObjectSwiftKotlin": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const swiftKotlinObject =
        NitroModules.createHybridObject<TestObjectSwiftKotlin>(
          "TestObjectSwiftKotlin",
        );

      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum(swiftKotlinObject),
      ).to.throw(
        `${testObject.name}.getVariantHybridEnum(...): Cannot convert "${String(swiftKotlinObject)}" to any type in `,
      );
    },

    "getVariantHybridEnum(...) throws for a Person": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum(TEST_PERSON),
      ).to.throw(
        `${testObject.name}.getVariantHybridEnum(...): Cannot convert "[object Object]" to any type in `,
      );
    },

    "getVariantTuple(...) checks every item, not just the first": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        testObject.getVariantTuple(
          // @ts-expect-error
          [10, "twenty"],
        ),
      ).to.throw(
        `${testObject.name}.getVariantTuple(...): Cannot convert "10,twenty" to any type in `,
      );
    },

    "getVariantTuple(...) throws for an empty array": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple([]),
      ).to.throw(
        `${testObject.name}.getVariantTuple(...): Cannot convert "" to any type in `,
      );
    },

    "getVariantTuple(...) keeps NaN and Infinity": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(testObject.getVariantTuple([NaN, Infinity])).to.deep.equal([
        NaN,
        Infinity,
      ]);
    },

    "someTuple roundtrips NaN and an empty string": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      testObject.someTuple = [NaN, ""];
      expect(testObject.someTuple).to.deep.equal([NaN, ""]);
    },

    "someTuple throws for 1 item": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const setOneItem = () => {
        // @ts-expect-error
        testObject.someTuple = [55];
      };
      expect(setOneItem).to.throw(
        `${testObject.name}.someTuple: The given JS Array has 1 items, but ${debugOnly("std::tuple<double, std::string>")}`,
      );
      expect(setOneItem).to.throw("expects 2 items");
    },

    "someTuple throws for a number in place of the string": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() => {
        // @ts-expect-error
        testObject.someTuple = [55, 66];
      }).to.throw(
        `${testObject.name}.someTuple: Value is a number, expected a String`,
      );
    },

    "someTuple keeps its value after a failed set": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      testObject.someTuple = [13, "before"];
      expect(() => {
        // @ts-expect-error
        testObject.someTuple = [55, 66];
      }).to.throw(`${testObject.name}.someTuple: `);
      expect(testObject.someTuple).to.deep.equal([13, "before"]);
    },

    "flip(...) keeps NaN, Infinity and -0": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(testObject.flip([NaN, Infinity, -0])).to.deep.equal([
        -0,
        Infinity,
        NaN,
      ]);
    },

    "flip(...) throws for 4 items": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const flipFourItems = () =>
        testObject.flip(
          // @ts-expect-error
          [1, 2, 3, 4],
        );
      expect(flipFourItems).to.throw(
        `${testObject.name}.flip(...): The given JS Array has 4 items, but ${debugOnly("std::tuple<double, double, double>")}`,
      );
      expect(flipFourItems).to.throw("expects 3 items");
    },

    "flip(...) throws for an empty array": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.flip([]),
      ).to.throw(
        `${testObject.name}.flip(...): The given JS Array has 0 items`,
      );
    },

    "flip(...) throws for a string item": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        testObject.flip(
          // @ts-expect-error
          [1, "two", 3],
        ),
      ).to.throw(
        `${testObject.name}.flip(...): Value is a string, expected a number`,
      );
    },

    "flip(...) throws for a non-array object": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.flip({ 0: 1, 1: 2, 2: 3, length: 3 }),
      ).to.throw(
        `${testObject.name}.flip(...): Object is an object, expected an array`,
      );
    },

    "flip(...) throws for a string": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.flip("abc"),
      ).to.throw(
        `${testObject.name}.flip(...): Value is a string, expected an Object`,
      );
    },

    "passTuple(...) bounces falsy values": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(testObject.passTuple([0, "", false])).to.deep.equal([
        0,
        "",
        false,
      ]);
    },

    "passTuple(...) throws for a string in place of the boolean": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        testObject.passTuple(
          // @ts-expect-error
          [13, "hello", "true"],
        ),
      ).to.throw(
        `${testObject.name}.passTuple(...): Value is a string, expected a boolean`,
      );
    },

    "passTuple(...) throws for a number in place of the string": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        testObject.passTuple(
          // @ts-expect-error
          [13, 42, true],
        ),
      ).to.throw(
        `${testObject.name}.passTuple(...): Value is a number, expected a String`,
      );
    },

    "passTuple(...) throws for 4 items": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const passFourItems = () =>
        testObject.passTuple(
          // @ts-expect-error
          [13, "hello", true, "extra"],
        );
      expect(passFourItems).to.throw(
        `${testObject.name}.passTuple(...): The given JS Array has 4 items, but ${debugOnly("std::tuple<double, std::string, bool>")}`,
      );
      expect(passFourItems).to.throw("expects 3 items");
    },

    "bounceCustomType(...) bounces an empty string": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(Object.is(testObject.bounceCustomType(""), "")).to.equal(true);
    },

    "bounceCustomType(...) bounces a unicode string": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(
        Object.is(
          testObject.bounceCustomType("héllo 👋 世界"),
          "héllo 👋 世界",
        ),
      ).to.equal(true);
    },

    "bounceCustomType(...) keeps an embedded NUL character": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(Object.is(testObject.bounceCustomType("a\0b"), "a\0b")).to.equal(
        true,
      );
    },

    "bounceCustomType(...) throws for a number": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.bounceCustomType(55),
      ).to.throw(
        `${testObject.name}.bounceCustomType(...): Value is a number, expected a String`,
      );
    },

    "bounceAnyHybrid(...) bounces itself": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(
        Object.is(testObject.bounceAnyHybrid(testObject), testObject),
      ).to.equal(true);
    },

    "bounceAnyHybrid(...) bounces a TestObjectSwiftKotlin": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const swiftKotlinObject =
        NitroModules.createHybridObject<TestObjectSwiftKotlin>(
          "TestObjectSwiftKotlin",
        );

      expect(
        Object.is(
          testObject.bounceAnyHybrid(swiftKotlinObject),
          swiftKotlinObject,
        ),
      ).to.equal(true);
    },

    "bounceAnyHybrid(...) bounces a C++ Child": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const child = testObject.createChild();
      expect(Object.is(testObject.bounceAnyHybrid(child), child)).to.equal(
        true,
      );
    },

    "bounceAnyHybrid(...) bounces a Swift/Kotlin Child": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const child = NitroModules.createHybridObject<Child>("Child");
      expect(Object.is(testObject.bounceAnyHybrid(child), child)).to.equal(
        true,
      );
    },

    "bounceAnyHybrid(...) bounces a Swift/Kotlin Base": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const base = NitroModules.createHybridObject<Base>("Base");
      expect(Object.is(testObject.bounceAnyHybrid(base), base)).to.equal(true);
    },

    "bounceAnyHybrid(...) throws for a plain object": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.bounceAnyHybrid({}),
      ).to.throw(
        `${testObject.name}.bounceAnyHybrid(...): Cannot convert "[object Object]" to NativeState<${debugOnly("margelo::nitro::HybridObject>! It does not have a NativeState!")}`,
      );
    },

    "bounceAnyHybrid(...) throws for undefined": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      expect(() =>
        // @ts-expect-error
        testObject.bounceAnyHybrid(undefined),
      ).to.throw(
        `${testObject.name}.bounceAnyHybrid(...): Cannot convert "undefined" to NativeState<margelo::nitro::HybridObject>! It is undefined!`,
      );
    },

    "rawJsiFunc() returns an empty array without arguments": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc;

      expect(rawObject.rawJsiFunc()).to.deep.equal([]);
    },

    "rawJsiFunc(...) keeps undefined and null arguments": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc;

      expect(rawObject.rawJsiFunc(undefined, null)).to.deep.equal([
        undefined,
        null,
      ]);
    },

    "rawJsiFunc(...) passes objects by reference": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc;

      const object = { some: "object" };
      const [result] = rawObject.rawJsiFunc(object) as unknown[];
      expect(Object.is(result, object)).to.equal(true);
    },

    "rawJsiFunc(...) passes functions by reference": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc;

      const func = () => {};
      const [result] = rawObject.rawJsiFunc(func) as unknown[];
      expect(Object.is(result, func)).to.equal(true);
    },

    "rawJsiFunc(...) throws for a `this` without NativeState": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc;

      expect(() => rawObject.rawJsiFunc.call({})).to.throw(
        "Cannot call hybrid function `HybridTestObjectCpp.rawJsiFunc(...)` - `this` does not have a NativeState!",
      );
    },

    "rawJsiFunc(...) throws for a different HybridObject as `this`": () => {
      const testObject =
        NitroModules.createHybridObject<TestObjectCpp>("TestObjectCpp");

      const rawObject = testObject as TestObjectCpp & WithRawJsiFunc;

      expect(() =>
        rawObject.rawJsiFunc.call(HybridSomeExternalObject),
      ).to.throw(
        "Cannot call hybrid function `HybridTestObjectCpp.rawJsiFunc(...)` - `this` has a NativeState, but it's the wrong type!",
      );
    },
  }),
};

export const skips = {
  "C++ only / TestObjectCpp / bounceAnyHybrid(...) throws for undefined": {
    release: "Existing main exclusion: IS_DEBUG",
  },
  "C++ only / TestObjectCpp / rawJsiFunc(...) throws for a `this` without NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "C++ only / TestObjectCpp / rawJsiFunc(...) throws for a different HybridObject as `this`":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
} as const;
