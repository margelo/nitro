import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

import type { AnyJSON } from "nitro-core";

import { TEST_MAP, TEST_MAP_2, TEST_MAP_3, TEST_MAP_4 } from "./utils/fixtures";

import { type TestObject } from "./utils/testObjects";

// createMap() builds its values from these getters - seed non-default values
// so AnyJSON has to carry a true bool, a non-empty string and a negative int64.
function seedPrimitives(testObject: TestObject) {
  testObject.numberValue = 14;
  testObject.boolValue = true;
  testObject.stringValue = "hello!";
  testObject.int64Value = -7362572367826385n;
}

const INT64_MIN = -(2n ** 63n);

const INT64_MAX = 2n ** 63n - 1n;

// An AnyJSON with objects and arrays nested a few levels deep.
const NESTED_MAP: AnyJSON = {
  level1: {
    level2: {
      level3: {
        array: [1, ["two", [true, { deepest: "value", number: 42 }]]],
      },
      empty: {},
    },
    emptyArray: [],
  },
  mixed: [1, "two", false, 3, [], {}],
};

function createKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `key_${i}`);
}

function getObject(value: AnyJSON): Record<string, AnyJSON> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an AnyJSON object");
  }
  return value;
}

export const cases = {
  ...casesForTestObjects("AnyJSON", {
    "createMap() contains every value type": (testObject) => {
      seedPrimitives(testObject);
      const result = getObject(testObject.createMap());
      expect(result.array).to.be.instanceOf(Array);
      expect(result.object).to.be.an("object");
      expect(result).to.deep.equal({
        number: 14,
        bool: true,
        string: "hello!",
        int64: Number(-7362572367826385n),
        null: null,
        array: result.array,
        object: result.object,
      });
    },

    "createMap().array contains every value type": (testObject) => {
      seedPrimitives(testObject);
      expect(getObject(testObject.createMap()).array).to.deep.equal([
        testObject.numberValue,
        testObject.boolValue,
        testObject.stringValue,
        Number(testObject.int64Value),
      ]);
    },

    "createMap().object contains every value type": (testObject) => {
      seedPrimitives(testObject);
      const values = [
        testObject.numberValue,
        testObject.boolValue,
        testObject.stringValue,
        Number(testObject.int64Value),
      ];
      expect(getObject(testObject.createMap()).object).to.deep.equal({
        array: [...values, values],
        int64: Number(testObject.int64Value),
        bool: testObject.boolValue,
        string: testObject.stringValue,
        number: testObject.numberValue,
        null: null,
      });
    },

    "mapRoundtrip(...) returns an equal map": (testObject) => {
      seedPrimitives(testObject);
      const map = testObject.createMap();
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map);
    },

    "getMapKeys(...) returns all keys": (testObject) => {
      seedPrimitives(testObject);
      const map = testObject.createMap();
      const keys = testObject.getMapKeys(map);
      expect([...keys].sort()).to.deep.equal(
        Object.keys(getObject(map)).sort(),
      );
    },

    "mergeMaps(...) merges both maps": (testObject) => {
      expect(testObject.mergeMaps(TEST_MAP, TEST_MAP_2)).to.deep.equal({
        ...TEST_MAP,
        ...TEST_MAP_2,
      });
    },

    "copyAnyMap(...) rejects a map containing bigint": (testObject) => {
      // @ts-expect-error BigInt is not a JSON value.
      expect(() => testObject.copyAnyMap(TEST_MAP_4)).to.throw();
    },
  }),
  ...casesForTestObjects("Typed maps", {
    "bounceMap(...) returns an equal map": (testObject) => {
      expect(testObject.bounceMap(TEST_MAP)).to.deep.equal(TEST_MAP);
    },

    "bounceSimpleMap(...) returns an equal map": (testObject) => {
      expect(testObject.bounceSimpleMap(TEST_MAP_3)).to.deep.equal(TEST_MAP_3);
    },

    "bounceOptionalMap(...) keeps undefined values": (testObject) => {
      expect(
        testObject.bounceOptionalMap({ a: "b", c: undefined }),
      ).to.deep.equal({ a: "b", c: undefined });
    },

    "bounceNullMap(...) keeps null values": (testObject) => {
      expect(testObject.bounceNullMap({ a: "b", c: null })).to.deep.equal({
        a: "b",
        c: null,
      });
    },

    "bounceOptionalNullMap(...) keeps null and undefined values": (
      testObject,
    ) => {
      expect(
        testObject.bounceOptionalNullMap({ a: "b", b: null, c: undefined }),
      ).to.deep.equal({ a: "b", b: null, c: undefined });
    },

    "extractMap(...) returns mapWrapper.map": (testObject) => {
      expect(
        testObject.extractMap({
          map: TEST_MAP_2,
          secondMap: { second: TEST_MAP_2 },
        }),
      ).to.deep.equal(TEST_MAP_2);
    },
  }),
  ...casesForTestObjects("AnyJSON values", {
    "mapRoundtrip(...) keeps a integer number value": (testObject) => {
      const value = 55;

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) keeps a fractional number value": (testObject) => {
      const value = -13.37;

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) keeps a true value": (testObject) => {
      const value = true;

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) keeps a false value": (testObject) => {
      const value = false;

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) keeps a string value": (testObject) => {
      const value = "hello";

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) keeps a empty string value": (testObject) => {
      const value = "";

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) keeps a null value": (testObject) => {
      const value = null;

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) rejects a bigint value": (testObject) => {
      const value = 1234567890123n;

      // @ts-expect-error BigInt is not a JSON value.
      expect(() => testObject.mapRoundtrip({ value: value })).to.throw();
    },

    "mapRoundtrip(...) rejects a negative bigint value": (testObject) => {
      const value = -55n;

      // @ts-expect-error BigInt is not a JSON value.
      expect(() => testObject.mapRoundtrip({ value: value })).to.throw();
    },

    "mapRoundtrip(...) keeps a empty array value": (testObject) => {
      const value: AnyJSON[] = [];

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) keeps a empty object value": (testObject) => {
      const value = {};

      expect(testObject.mapRoundtrip({ value: value })).to.deep.equal({
        value: value,
      });
    },

    "mapRoundtrip(...) rejects the int64 boundaries as bigints": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error BigInt is not a JSON value.
        testObject.mapRoundtrip({ min: INT64_MIN, max: INT64_MAX }),
      ).to.throw();
    },

    "mapRoundtrip(...) keeps numbers beyond 2^53 as numbers": (testObject) => {
      const map = { big: 2 ** 64, max: Number.MAX_VALUE };
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map);
    },

    "mapRoundtrip(...) keeps nested objects and arrays": (testObject) => {
      expect(testObject.mapRoundtrip(NESTED_MAP)).to.deep.equal(NESTED_MAP);
    },

    "mapRoundtrip(...) keeps null inside arrays": (testObject) => {
      const map = { array: [null, 1, null] };
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map);
    },

    "mapRoundtrip(...) keeps null inside objects": (testObject) => {
      const map = { object: { a: null, b: 1 } };
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map);
    },

    "copyAnyMap(...) keeps nested objects and arrays": (testObject) => {
      expect(testObject.copyAnyMap(NESTED_MAP)).to.deep.equal(NESTED_MAP);
    },

    "copyAnyMap(...) keeps null inside arrays": (testObject) => {
      const map = { array: [null, 1, null] };
      expect(testObject.copyAnyMap(map)).to.deep.equal(map);
    },

    "copyAnyMap(...) keeps null inside objects": (testObject) => {
      const map = { object: { a: null, b: 1 } };
      expect(testObject.copyAnyMap(map)).to.deep.equal(map);
    },

    "copyAnyMap(...) rejects the int64 boundaries as bigints": (testObject) => {
      expect(() =>
        // @ts-expect-error BigInt is not a JSON value.
        testObject.copyAnyMap({ min: INT64_MIN, max: INT64_MAX }),
      ).to.throw();
    },

    "mapRoundtrip(...) returns a new object": (testObject) => {
      const map = { a: 1 };
      expect(Object.is(testObject.mapRoundtrip(map), map)).to.equal(false);
    },
  }),
  ...casesForTestObjects("AnyJSON keys", {
    "mapRoundtrip(...) returns {} for an empty map": (testObject) => {
      expect(testObject.mapRoundtrip({})).to.deep.equal({});
    },

    "copyAnyMap(...) returns {} for an empty map": (testObject) => {
      expect(testObject.copyAnyMap({})).to.deep.equal({});
    },

    "getMapKeys(...) returns [] for an empty map": (testObject) => {
      expect(testObject.getMapKeys({})).to.deep.equal([]);
    },

    "mapRoundtrip(...) keeps 1,000 keys": (testObject) => {
      const map = Object.fromEntries(
        createKeys(1_000).map((key, i) => [key, i]),
      );
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map);
    },

    "getMapKeys(...) returns each of 1,000 keys once": (testObject) => {
      const keys = createKeys(1_000);
      const map = Object.fromEntries(keys.map((key) => [key, true]));
      expect([...testObject.getMapKeys(map)].sort()).to.deep.equal(
        [...keys].sort(),
      );
    },

    "mapRoundtrip(...) keeps unicode keys": (testObject) => {
      const map = { "🔥": 1, ключ: "значение", 日本語: true };
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map);
    },

    "mapRoundtrip(...) keeps an empty string key": (testObject) => {
      expect(testObject.mapRoundtrip({ "": "empty" })).to.deep.equal({
        "": "empty",
      });
    },

    "mapRoundtrip(...) keeps numeric keys": (testObject) => {
      const map = { 0: "zero", 42: "answer" };
      expect(testObject.mapRoundtrip(map)).to.deep.equal(map);
    },
  }),
  ...casesForTestObjects("AnyJSON merging", {
    "mergeMaps(...) returns {} for two empty maps": (testObject) => {
      expect(testObject.mergeMaps({}, {})).to.deep.equal({});
    },

    "mergeMaps(...) returns the first map for an empty second map": (
      testObject,
    ) => {
      expect(testObject.mergeMaps({ a: 1, b: "b" }, {})).to.deep.equal({
        a: 1,
        b: "b",
      });
    },

    "mergeMaps(...) returns the second map for an empty first map": (
      testObject,
    ) => {
      expect(testObject.mergeMaps({}, { a: 1, b: "b" })).to.deep.equal({
        a: 1,
        b: "b",
      });
    },

    "mergeMaps(...) prefers values of the second map": (testObject) => {
      expect(
        testObject.mergeMaps({ a: 1, shared: 2 }, { shared: 3, b: 4 }),
      ).to.deep.equal({ a: 1, shared: 3, b: 4 });
    },

    "mergeMaps(...) replaces a value with one of a different type": (
      testObject,
    ) => {
      expect(
        testObject.mergeMaps({ shared: 1 }, { shared: [1, "one"] }),
      ).to.deep.equal({ shared: [1, "one"] });
    },

    "mergeMaps(...) replaces nested objects instead of merging them": (
      testObject,
    ) => {
      expect(
        testObject.mergeMaps({ nested: { a: 1, b: 2 } }, { nested: { b: 3 } }),
      ).to.deep.equal({ nested: { b: 3 } });
    },
  }),
  ...casesForTestObjects("AnyJSON serialization", {
    "mapRoundtrip(...) accepts a number": (testObject) => {
      expect(testObject.mapRoundtrip(5)).to.equal(5);
    },

    "mapRoundtrip(...) omits undefined object properties": (testObject) => {
      // @ts-expect-error Undefined is not a declared JSON value.
      const result = testObject.mapRoundtrip({ keep: 1, a: undefined });
      expect(result).to.deep.equal({ keep: 1 });
    },

    "mapRoundtrip(...) converts undefined array elements to null": (
      testObject,
    ) => {
      // @ts-expect-error Undefined is not a declared JSON value.
      const result = testObject.mapRoundtrip({ a: [1, undefined] });
      expect(result).to.deep.equal({ a: [1, null] });
    },

    "mapRoundtrip(...) omits function object properties": (testObject) => {
      // @ts-expect-error Functions are not declared JSON values.
      const result = testObject.mapRoundtrip({ keep: 1, a: () => {} });
      expect(result).to.deep.equal({ keep: 1 });
    },

    "mapRoundtrip(...) omits symbol object properties": (testObject) => {
      // @ts-expect-error Symbols are not declared JSON values.
      const result = testObject.mapRoundtrip({ keep: 1, a: Symbol("a") });
      expect(result).to.deep.equal({ keep: 1 });
    },

    "mapRoundtrip(...) converts functions and symbols in arrays to null": (
      testObject,
    ) => {
      // @ts-expect-error Functions and symbols are not declared JSON values.
      const result = testObject.mapRoundtrip([1, () => {}, Symbol("a")]);
      expect(result).to.deep.equal([1, null, null]);
    },

    "mapRoundtrip(...) converts nonfinite numbers to null": (testObject) => {
      expect(
        testObject.mapRoundtrip({ a: NaN, b: Infinity, c: -Infinity }),
      ).to.deep.equal({ a: null, b: null, c: null });
      expect(testObject.mapRoundtrip([NaN, Infinity, -Infinity])).to.deep.equal(
        [null, null, null],
      );
      expect(testObject.mapRoundtrip(NaN)).to.equal(null);
    },

    "mapRoundtrip(...) serializes ArrayBuffer values as empty objects": (
      testObject,
    ) => {
      // @ts-expect-error ArrayBuffer is not a declared JSON value.
      const result = testObject.mapRoundtrip({ a: new ArrayBuffer(8) });
      expect(result).to.deep.equal({ a: {} });
    },

    "mapRoundtrip(...) rejects a bigint beyond int64": (testObject) => {
      // @ts-expect-error BigInt is not a JSON value.
      expect(() => testObject.mapRoundtrip({ a: INT64_MAX + 1n })).to.throw();
      expect(testObject.mapRoundtrip({ valid: true })).to.deep.equal({
        valid: true,
      });
    },

    "mapRoundtrip(...) rejects circular objects": (testObject) => {
      const circular: Record<string, AnyJSON> = {};
      circular.self = circular;
      expect(() => testObject.mapRoundtrip(circular)).to.throw();
      expect(testObject.mapRoundtrip({ valid: true })).to.deep.equal({
        valid: true,
      });
    },

    "mapRoundtrip(...) rejects circular arrays": (testObject) => {
      const circular: AnyJSON[] = [];
      circular.push(circular);
      expect(() => testObject.mapRoundtrip(circular)).to.throw();
      expect(testObject.mapRoundtrip([])).to.deep.equal([]);
    },

    "mapRoundtrip(...) rejects top-level undefined, functions and symbols": (
      testObject,
    ) => {
      // @ts-expect-error Undefined is not a JSON value.
      expect(() => testObject.mapRoundtrip(undefined)).to.throw();
      // @ts-expect-error Functions are not JSON values.
      expect(() => testObject.mapRoundtrip(() => {})).to.throw();
      // @ts-expect-error Symbols are not JSON values.
      expect(() => testObject.mapRoundtrip(Symbol("a"))).to.throw();
      expect(testObject.mapRoundtrip(null)).to.equal(null);
    },
  }),
  ...casesForTestObjects("Typed map edge cases", {
    "bounceSimpleMap(...) returns {} for an empty map": (testObject) => {
      expect(testObject.bounceSimpleMap({})).to.deep.equal({});
    },

    "bounceSimpleMap(...) keeps 1,000 keys": (testObject) => {
      const map = Object.fromEntries(
        createKeys(1_000).map((key, i) => [key, i]),
      );
      expect(testObject.bounceSimpleMap(map)).to.deep.equal(map);
    },

    // TODO: Fix in Nitro - values of non-ASCII keys are read as undefined (`PropNameIDCache` uses `PropNameID::forAscii`, also used by `JSIConverter<unordered_map>::toJSI` for the returned keys), throws "Value is undefined, expected a number"
    // it('bounceSimpleMap(...) keeps unicode keys', () => {
    //   const map = { '🔥': 1, 'ключ': 2, '日本語': 3 }
    //   expect(testObject.bounceSimpleMap(map)).toStrictEqual(map)
    // })

    "bounceMap(...) keeps booleans and numbers apart": (testObject) => {
      const map = { zero: 0, one: 1, no: false, yes: true };
      expect(testObject.bounceMap(map)).to.deep.equal(map);
    },

    "extractMap(...) returns {} for an empty map": (testObject) => {
      expect(
        testObject.extractMap({ map: {}, secondMap: { second: {} } }),
      ).to.deep.equal({});
    },

    "bounceSimpleMap(...) rejects a number": (testObject) => {
      // @ts-expect-error passing a number instead of a map
      expect(() => testObject.bounceSimpleMap(5)).to.throw(
        `${testObject.constructor.name}.bounceSimpleMap(...): Value is a number, expected an Object`,
      );
    },

    "bounceSimpleMap(...) rejects a string value": (testObject) => {
      // @ts-expect-error passing a string value
      expect(() => testObject.bounceSimpleMap({ a: 1, b: "2" })).to.throw(
        `${testObject.constructor.name}.bounceSimpleMap(...): Value is a string, expected a number`,
      );
    },

    "bounceMap(...) rejects a string value": (testObject) => {
      // @ts-expect-error passing a string value
      expect(() => testObject.bounceMap({ a: "yes" })).to.throw(
        `${testObject.constructor.name}.bounceMap(...): Cannot convert "yes" to any type in variant<`,
      );
    },

    "bounceOptionalMap(...) rejects null values": (testObject) => {
      // @ts-expect-error passing null where only undefined is optional
      expect(() => testObject.bounceOptionalMap({ a: null })).to.throw(
        `${testObject.constructor.name}.bounceOptionalMap(...): Value is null, expected a String`,
      );
    },

    "bounceNullMap(...) rejects undefined values": (testObject) => {
      // @ts-expect-error passing undefined where only null is allowed
      expect(() => testObject.bounceNullMap({ a: undefined })).to.throw(
        `${testObject.constructor.name}.bounceNullMap(...): Cannot convert "undefined" to any type in variant<`,
      );
    },

    "extractMap(...) rejects a missing secondMap": (testObject) => {
      // @ts-expect-error passing a MapWrapper without secondMap
      expect(() => testObject.extractMap({ map: {} })).to.throw(
        `${testObject.constructor.name}.extractMap(...): Value is undefined, expected an Object`,
      );
    },
  }),
};
