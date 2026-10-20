import { expect } from "chai";
import { casesForTestObjects, recordCallback, waitFor } from "./utils/cases";

import { getNitroModules } from "nitro-core";
import type { Base } from "nitro-test";
import {
  type Car,
  OldEnum,
  type Powertrain,
  WeirdNumbersEnum,
  type WrappedJsStruct,
} from "nitro-test";

import { TEST_CAR, TEST_CAR_2, TEST_PERSON } from "./utils/fixtures";
import { debugOnly, deferred } from "./utils/helpers";
import { type TestObject } from "./utils/testObjects";

const NitroModules = getNitroModules();

const BASE = NitroModules.createHybridObject<Base>("Base");

const POWERTRAINS: Powertrain[] = ["electric", "gas", "hybrid"];

const WEIRD_NUMBERS = [
  WeirdNumbersEnum.A,
  WeirdNumbersEnum.B,
  WeirdNumbersEnum.C,
];

// A Car without any of its optional keys (not even set to `undefined`)
const MINIMAL_CAR: Car = {
  year: 2020,
  make: "Tesla",
  model: "Model 3",
  power: 283,
  powertrain: "electric",
  passengers: [],
  performanceScores: [],
};

// The original toEqual ignores undefined-valued keys. Preserve that behavior
// when comparing structs whose optional properties were omitted from the input.
function definedProperties(value: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, property]) => property !== undefined),
  );
}

export const cases = {
  ...casesForTestObjects("Variants", {
    "someVariant roundtrips a number": (testObject) => {
      testObject.someVariant = 55;
      expect(Object.is(testObject.someVariant, 55)).to.equal(true);
    },

    "someVariant roundtrips a string": (testObject) => {
      testObject.someVariant = "some-string";
      expect(Object.is(testObject.someVariant, "some-string")).to.equal(true);
    },

    "someVariant throws when set to a boolean": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.someVariant = false;
      }).to.throw(
        `${testObject.name}.someVariant: Cannot convert "false" to any type in ${debugOnly("variant<double, std::string>!")}`,
      );
    },

    "passVariant(...) returns a fallback for an array": (testObject) => {
      expect(
        Object.is(testObject.passVariant([1, 2, 3]), "holds something else!"),
      ).to.equal(true);
    },

    "passVariant(...) bounces a string": (testObject) => {
      expect(Object.is(testObject.passVariant("hello!"), "hello!")).to.equal(
        true,
      );
    },

    "passVariant(...) bounces a number": (testObject) => {
      expect(Object.is(testObject.passVariant(5), 5)).to.equal(true);
    },

    "passVariant(...) throws for an object": (testObject) => {
      expect(() =>
        testObject.passVariant(
          // @ts-expect-error
          {},
        ),
      ).to.throw(
        `${testObject.name}.passVariant(...): Cannot convert "[object Object]" to any type in `,
      );
    },

    "passAllEmptyObjectVariant(...) bounces an empty object": (testObject) => {
      // `toEqual({})` would also match a (release) HybridObject, so check that
      // it came back as an OptionalWrapper struct with every key.
      expect(testObject.passAllEmptyObjectVariant({})).to.deep.equal({
        optionalArrayBuffer: undefined,
        optionalString: undefined,
      });
    },

    "passAllEmptyObjectVariant(...) bounces an OptionalWrapper": (
      testObject,
    ) => {
      expect(
        definedProperties(
          testObject.passAllEmptyObjectVariant({
            optionalString: "optional string!",
          }),
        ),
      ).to.deep.equal({ optionalString: "optional string!" });
    },

    "passAllEmptyObjectVariant(...) bounces a Base": (testObject) => {
      expect(
        Object.is(testObject.passAllEmptyObjectVariant(BASE), BASE),
      ).to.equal(true);
    },

    "bounceComplexVariant(...) bounces an ArrayBuffer": (testObject) => {
      const buffer = testObject.createArrayBuffer();
      // The buffer is 10 MB of uninitialized memory, so don't compare (or
      // print) all of its bytes - only a few marked ones.
      const bytes = new Uint8Array(buffer);
      bytes.set([13, 37]);
      bytes[bytes.length - 1] = 42;
      const result = testObject.bounceComplexVariant(buffer);
      expect(result).to.be.instanceOf(ArrayBuffer);
      const resultBytes = new Uint8Array(result as ArrayBuffer);
      expect(Object.is(resultBytes.byteLength, buffer.byteLength)).to.equal(
        true,
      );
      expect([
        resultBytes[0],
        resultBytes[1],
        resultBytes[resultBytes.length - 1],
      ]).to.deep.equal([13, 37, 42]);
    },

    "bounceComplexVariant(...) bounces a Promise": async (testObject) => {
      const { promise, resolve } = deferred<number>();
      const result = testObject.bounceComplexVariant(promise);
      expect(result).to.be.instanceOf(Promise);
      resolve(55);
      await expect(Object.is(await result, 55)).to.equal(true);
    },

    "bounceComplexVariant(...) bounces a callback": async (testObject) => {
      const callback = recordCallback<(value: number) => void>();
      const result = testObject.bounceComplexVariant(callback);
      expect(result).to.be.a("function");
      const bounced = result as (value: number) => void;
      bounced(5);
      await waitFor(() => expect(callback.calls).to.deep.include([5]), {
        timeout: 2000,
      });
    },

    "bounceComplexVariant(...) bounces a struct": (testObject) => {
      const result = testObject.bounceComplexVariant({
        items: [],
        value: { onChanged: () => {}, value: 55 },
      }) as WrappedJsStruct;
      expect(result.value.onChanged).to.be.a("function");
      expect(result).to.deep.equal({
        items: [],
        value: { onChanged: result.value.onChanged, value: 55 },
      });
    },

    "bounceComplexVariant(...) bounces an AnyMap": (testObject) => {
      expect(
        testObject.bounceComplexVariant({ whateverValue: 55 }),
      ).to.deep.equal({
        whateverValue: 55,
      });
    },

    "bounceComplexVariant(...) bounces a Date": (testObject) => {
      const date = new Date();
      const result = testObject.bounceComplexVariant(date);
      expect(result).to.be.instanceOf(Date);
      expect(result).to.deep.equal(date);
    },

    "createChild().bounceVariant(...) bounces a string": (testObject) => {
      expect(
        Object.is(testObject.createChild().bounceVariant("hello!"), "hello!"),
      ).to.equal(true);
    },

    "getVariantEnum(...) bounces an enum": (testObject) => {
      expect(
        Object.is(testObject.getVariantEnum(OldEnum.THIRD), OldEnum.THIRD),
      ).to.equal(true);
    },

    "getVariantEnum(...) bounces a boolean": (testObject) => {
      expect(Object.is(testObject.getVariantEnum(true), true)).to.equal(true);
    },

    "getVariantEnum(...) throws for a string": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum("string"),
      ).to.throw(
        `${testObject.name}.getVariantEnum(...): Cannot convert "string" to any type in ${debugOnly("variant<margelo::nitro::test::OldEnum, bool>!")}`,
      );
    },

    "getVariantEnum(...) throws for an out-of-range number": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum(9999),
      ).to.throw(
        `${testObject.name}.getVariantEnum(...): Cannot convert "9999" to any type in ${debugOnly("variant<margelo::nitro::test::OldEnum, bool>!")}`,
      );
    },

    "bounceVariantUnionEnum(...) bounces a Car": (testObject) => {
      expect(testObject.bounceVariantUnionEnum(TEST_CAR)).to.deep.equal(
        TEST_CAR,
      );
    },

    "bounceVariantUnionEnum(...) throws for an unknown string": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceVariantUnionEnum("diesel"),
      ).to.throw(
        `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "diesel" to any type in `,
      );
    },

    "bounceVariantUnionEnum(...) throws for a wrong object": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceVariantUnionEnum({}),
      ).to.throw(
        `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "[object Object]" to any type in `,
      );
    },

    "bounceVariantUnionEnum(...) throws for a boolean": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceVariantUnionEnum(true),
      ).to.throw(
        `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "true" to any type in `,
      );
    },

    "getVariantWeirdNumbersEnum(...) bounces a boolean": (testObject) => {
      expect(
        Object.is(testObject.getVariantWeirdNumbersEnum(true), true),
      ).to.equal(true);
    },

    "getVariantWeirdNumbersEnum(...) throws for a string": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantWeirdNumbersEnum("string"),
      ).to.throw(
        `${testObject.name}.getVariantWeirdNumbersEnum(...): Cannot convert "string" to any type in ${debugOnly("variant<margelo::nitro::test::WeirdNumbersEnum, bool>!")}`,
      );
    },

    "getVariantWeirdNumbersEnum(...) throws for an out-of-range number": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantWeirdNumbersEnum(99999),
      ).to.throw(
        `${testObject.name}.getVariantWeirdNumbersEnum(...): Cannot convert "99999" to any type in ${debugOnly("variant<margelo::nitro::test::WeirdNumbersEnum, bool>!")}`,
      );
    },

    "getVariantObjects(...) bounces a Person": (testObject) => {
      expect(testObject.getVariantObjects(TEST_PERSON)).to.deep.equal(
        TEST_PERSON,
      );
    },

    "getVariantObjects(...) bounces a Car": (testObject) => {
      expect(testObject.getVariantObjects(TEST_CAR)).to.deep.equal(TEST_CAR);
    },

    "getVariantObjects(...) bounces a Car with a driver": (testObject) => {
      const car = { ...TEST_CAR, driver: TEST_PERSON };
      expect(testObject.getVariantObjects(car)).to.deep.equal(car);
    },

    "getVariantObjects(...) throws for a string": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects("some-string"),
      ).to.throw(
        `${testObject.name}.getVariantObjects(...): Cannot convert "some-string" to any type in ${debugOnly("variant<margelo::nitro::test::Person, margelo::nitro::test::Car>!")}`,
      );
    },

    "getVariantObjects(...) throws for a wrong object": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects({ someValue: 55 }),
      ).to.throw(
        `${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in ${debugOnly("variant<margelo::nitro::test::Person, margelo::nitro::test::Car>!")}`,
      );
    },

    "getVariantHybrid(...) bounces a HybridObject": (testObject) => {
      // @ts-expect-error `testObject` is a union of both TestObject types
      const result = testObject.getVariantHybrid(testObject);
      expect(Object.is(result, testObject)).to.equal(true);
    },

    "getVariantHybrid(...) bounces a Person": (testObject) => {
      expect(testObject.getVariantHybrid(TEST_PERSON)).to.deep.equal(
        TEST_PERSON,
      );
    },

    "getVariantHybrid(...) throws for a string": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybrid("some-string"),
      ).to.throw(
        `${testObject.name}.getVariantHybrid(...): Cannot convert "some-string" to any type in `,
      );
    },

    "getVariantHybrid(...) throws for a wrong object": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybrid({ someValue: 55 }),
      ).to.throw(
        `${testObject.name}.getVariantHybrid(...): Cannot convert "[object Object]" to any type in `,
      );
    },

    "passNamedVariant(...) bounces a string": (testObject) => {
      expect(
        Object.is(testObject.passNamedVariant("Hello world!"), "Hello world!"),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("Variant edge cases", {
    "someVariant switches from a string back to a number": (testObject) => {
      testObject.someVariant = "some-string";
      testObject.someVariant = 55;
      expect(Object.is(testObject.someVariant, 55)).to.equal(true);
    },

    "someVariant keeps a numeric string a string": (testObject) => {
      testObject.someVariant = "55";
      expect(Object.is(testObject.someVariant, "55")).to.equal(true);
    },

    "someVariant roundtrips -0": (testObject) => {
      testObject.someVariant = -0;
      expect(Object.is(testObject.someVariant, -0)).to.equal(true);
    },

    "someVariant throws when set to null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.someVariant = null;
      }).to.throw(
        `${testObject.name}.someVariant: Cannot convert "null" to any type in ${debugOnly("variant<double, std::string>!")}`,
      );
    },

    "someVariant throws when set to undefined": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.someVariant = undefined;
      }).to.throw(
        `${testObject.name}.someVariant: Cannot convert "undefined" to any type in ${debugOnly("variant<double, std::string>!")}`,
      );
    },

    "someVariant keeps its value after a failed set": (testObject) => {
      testObject.someVariant = "before";
      expect(() => {
        // @ts-expect-error
        testObject.someVariant = false;
      }).to.throw(`${testObject.name}.someVariant: Cannot convert "false"`);
      expect(Object.is(testObject.someVariant, "before")).to.equal(true);
    },

    "passVariant(...) bounces 0 as a number": (testObject) => {
      expect(Object.is(testObject.passVariant(0), 0)).to.equal(true);
    },

    "passVariant(...) bounces NaN": (testObject) => {
      expect(testObject.passVariant(NaN)).to.be.NaN;
    },

    "passVariant(...) bounces an empty string": (testObject) => {
      expect(Object.is(testObject.passVariant(""), "")).to.equal(true);
    },

    "passVariant(...) keeps a numeric string a string": (testObject) => {
      expect(Object.is(testObject.passVariant("5"), "5")).to.equal(true);
    },

    "passVariant(...) returns a fallback for false": (testObject) => {
      expect(
        Object.is(testObject.passVariant(false), "holds something else!"),
      ).to.equal(true);
    },

    "passVariant(...) returns a fallback for an empty array": (testObject) => {
      expect(
        Object.is(testObject.passVariant([]), "holds something else!"),
      ).to.equal(true);
    },

    "passVariant(...) returns a fallback for a string array": (testObject) => {
      expect(
        Object.is(testObject.passVariant(["a", "b"]), "holds something else!"),
      ).to.equal(true);
    },

    "passVariant(...) throws for null with every accepted type": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error
        testObject.passVariant(null),
      ).to.throw(
        `${testObject.name}.passVariant(...): Cannot convert "null" to any type in ${debugOnly("variant<bool, std::vector<double>, std::vector<std::string>, double, std::string>!")}`,
      );
    },

    "passVariant(...) throws for a bigint": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.passVariant(5n),
      ).to.throw(
        `${testObject.name}.passVariant(...): Cannot convert "5" to any type in `,
      );
    },

    "passVariant(...) throws for nested arrays": (testObject) => {
      expect(() =>
        testObject.passVariant(
          // @ts-expect-error
          [[1, 2], [3]],
        ),
      ).to.throw(
        `${testObject.name}.passVariant(...): Cannot convert "1,2,3" to any type in `,
      );
    },

    "passVariant(...) throws for a mixed number/string array": (testObject) => {
      expect(() =>
        testObject.passVariant(
          // @ts-expect-error
          [1, "two"],
        ),
      ).to.throw(`${testObject.name}.passVariant(...): `);
    },

    "getVariantEnum(...) bounces OldEnum.FIRST (0)": (testObject) => {
      expect(
        Object.is(testObject.getVariantEnum(OldEnum.FIRST), OldEnum.FIRST),
      ).to.equal(true);
    },

    "getVariantEnum(...) bounces false": (testObject) => {
      expect(Object.is(testObject.getVariantEnum(false), false)).to.equal(true);
    },

    "getVariantEnum(...) throws one past the last enum value": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum(3),
      ).to.throw(
        `${testObject.name}.getVariantEnum(...): Cannot convert "3" to any type in `,
      );
    },

    "getVariantEnum(...) throws for a negative number": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum(-1),
      ).to.throw(
        `${testObject.name}.getVariantEnum(...): Cannot convert "-1" to any type in `,
      );
    },

    "getVariantEnum(...) throws for a fractional number": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantEnum(1.5),
      ).to.throw(
        `${testObject.name}.getVariantEnum(...): Cannot convert "1.5" to any type in `,
      );
    },

    "getVariantWeirdNumbersEnum(...) bounces every enum value": (
      testObject,
    ) => {
      for (const value of WEIRD_NUMBERS) {
        expect(
          Object.is(testObject.getVariantWeirdNumbersEnum(value), value),
          `${value}`,
        ).to.equal(true);
      }
    },

    "getVariantWeirdNumbersEnum(...) bounces false": (testObject) => {
      expect(
        Object.is(testObject.getVariantWeirdNumbersEnum(false), false),
      ).to.equal(true);
    },

    "getVariantWeirdNumbersEnum(...) throws between two enum values": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantWeirdNumbersEnum(33),
      ).to.throw(
        `${testObject.name}.getVariantWeirdNumbersEnum(...): Cannot convert "33" to any type in `,
      );
    },

    "bounceVariantUnionEnum(...) bounces every Powertrain": (testObject) => {
      for (const powertrain of POWERTRAINS) {
        expect(
          Object.is(testObject.bounceVariantUnionEnum(powertrain), powertrain),
          powertrain,
        ).to.equal(true);
      }
    },

    "bounceVariantUnionEnum(...) throws for a differently cased Powertrain": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceVariantUnionEnum("GAS"),
      ).to.throw(
        `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "GAS" to any type in ${debugOnly("variant<margelo::nitro::test::Powertrain, margelo::nitro::test::Car>!")}`,
      );
    },

    "bounceVariantUnionEnum(...) throws for a Car with an unknown powertrain": (
      testObject,
    ) => {
      expect(() =>
        testObject.bounceVariantUnionEnum({
          ...TEST_CAR,
          // @ts-expect-error
          powertrain: "diesel",
        }),
      ).to.throw(
        `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "[object Object]" to any type in `,
      );
    },

    "getVariantObjects(...) resolves an object matching Person and Car to Person":
      (testObject) => {
        const personAndCar = { ...TEST_CAR, ...TEST_PERSON };
        expect(testObject.getVariantObjects(personAndCar)).to.deep.equal(
          TEST_PERSON,
        );
      },

    "getVariantObjects(...) drops unknown keys from a Person": (testObject) => {
      const person = { ...TEST_PERSON, nickname: "mrousavy" };
      expect(testObject.getVariantObjects(person)).to.deep.equal(TEST_PERSON);
    },

    "getVariantObjects(...) bounces a Car without optional keys": (
      testObject,
    ) => {
      expect(
        definedProperties(testObject.getVariantObjects(MINIMAL_CAR)),
      ).to.deep.equal(MINIMAL_CAR);
    },

    "getVariantObjects(...) throws for a Person without age": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects({ name: "Marc" }),
      ).to.throw(
        `${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `,
      );
    },

    "getVariantObjects(...) throws for a Car without passengers": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects({ ...TEST_CAR, passengers: undefined }),
      ).to.throw(
        `${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `,
      );
    },

    "getVariantObjects(...) throws for an array of Persons": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantObjects([TEST_PERSON]),
      ).to.throw(
        `${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `,
      );
    },

    "getVariantHybrid(...) bounces another instance of the same type": (
      testObject,
    ) => {
      const other = testObject.newTestObject();
      // @ts-expect-error `testObject` is a union of both TestObject types
      expect(Object.is(testObject.getVariantHybrid(other), other)).to.equal(
        true,
      );
    },

    "getVariantHybrid(...) throws for the other TestObject implementation": (
      testObject,
    ) => {
      const otherName =
        testObject.name === "TestObjectCpp"
          ? "TestObjectSwiftKotlin"
          : "TestObjectCpp";
      const other = NitroModules.createHybridObject<TestObject>(otherName);
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybrid(other),
      ).to.throw(
        `${testObject.name}.getVariantHybrid(...): Cannot convert "${String(other)}" to any type in `,
      );
    },

    "passNamedVariant(...) bounces a Car": (testObject) => {
      expect(testObject.passNamedVariant(TEST_CAR_2)).to.deep.equal(TEST_CAR_2);
    },

    "passNamedVariant(...) throws for a number": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.passNamedVariant(55),
      ).to.throw(
        `${testObject.name}.passNamedVariant(...): Cannot convert "55" to any type in ${debugOnly("variant<std::string, margelo::nitro::test::Car>!")}`,
      );
    },

    "createChild().bounceVariant(...) bounces a Car": (testObject) => {
      expect(testObject.createChild().bounceVariant(TEST_CAR_2)).to.deep.equal(
        TEST_CAR_2,
      );
    },

    "createChild().bounceVariant(...) throws for a number": (testObject) => {
      const child = testObject.createChild();
      expect(() =>
        // @ts-expect-error
        child.bounceVariant(55),
      ).to.throw(
        `${child.name}.bounceVariant(...): Cannot convert "55" to any type in `,
      );
    },

    "passAllEmptyObjectVariant(...) bounces a Child as the same object": (
      testObject,
    ) => {
      const child = testObject.createChild();
      expect(
        Object.is(testObject.passAllEmptyObjectVariant(child), child),
      ).to.equal(true);
    },

    "passAllEmptyObjectVariant(...) throws for a non-Base HybridObject": (
      testObject,
    ) => {
      expect(() => testObject.passAllEmptyObjectVariant(testObject)).to.throw(
        `${testObject.name}.passAllEmptyObjectVariant(...): Cannot convert "${String(testObject)}" to any type in `,
      );
    },

    "passAllEmptyObjectVariant(...) throws for a wrongly typed OptionalWrapper":
      (testObject) => {
        expect(() =>
          // @ts-expect-error
          testObject.passAllEmptyObjectVariant({ optionalString: 55 }),
        ).to.throw(
          `${testObject.name}.passAllEmptyObjectVariant(...): Cannot convert "[object Object]" to any type in `,
        );
      },

    "bounceComplexVariant(...) falls back to an AnyMap for a mismatching struct":
      (testObject) => {
        const map = { value: 55, items: "not-an-array" };
        expect(testObject.bounceComplexVariant(map)).to.deep.equal(map);
      },

    "bounceComplexVariant(...) throws for a number": (testObject) => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceComplexVariant(55),
      ).to.throw(
        `${testObject.name}.bounceComplexVariant(...): Cannot convert "55" to any type in `,
      );
    },
  }),
};
