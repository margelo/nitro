import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

import type { AnyMap, ValueType } from "nitro-core";

import { TEST_MAP, TEST_MAP_2, TEST_MAP_3, TEST_MAP_4 } from "./utils/fixtures";

import { type TestObject } from "./utils/testObjects";

// createMap() builds its values from these getters - seed non-default values
// so AnyMap has to carry a true bool, a non-empty string and a negative int64.
function seedPrimitives(testObject: TestObject) {
  testObject.numberValue = 14;
  testObject.boolValue = true;
  testObject.stringValue = "hello!";
  testObject.int64Value = -7362572367826385n;
}

const INT64_MIN = -(2n ** 63n);

const INT64_MAX = 2n ** 63n - 1n;

// An AnyMap with objects and arrays nested a few levels deep.
const NESTED_MAP: AnyMap = {
  level1: {
    level2: {
      level3: {
        array: [1, ["two", [true, { deepest: "value", bigint: 42n }]]],
      },
      empty: {},
    },
    emptyArray: [],
  },
  mixed: [1, "two", false, 3n, [], {}],
};

function createKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `key_${i}`);
}

// Every AnyMap value type, each kept as the only value of a map.
const ANY_MAP_VALUES: ReadonlyArray<[label: string, value: ValueType]> = [
  ["integer number", 55],
  ["fractional number", -13.37],
  ["true", true],
  ["false", false],
  ["string", "hello"],
  ["empty string", ""],
  ["null", null],
  ["bigint", 1234567890123n],
  ["negative bigint", -55n],
  ["empty array", []],
  ["empty object", {}],
];
export const cases = {
  ...casesForTestObjects("AnyMap", {
    "createMap() contains every value type": (testObject) => {
      seedPrimitives(testObject);
      const result = testObject.createMap();
      expect(result.array).to.be.instanceOf(Array);
      expect(result.object).to.be.an("object");
      expect(result).to.deep.equal({
        number: 14,
        bool: true,
        string: "hello!",
        int64: -7362572367826385n,
        null: null,
        array: result.array,
        object: result.object,
      });
    },

    "createMap().array contains every value type": (testObject) => {
      seedPrimitives(testObject);
      expect(testObject.createMap().array).to.deep.equal([
        testObject.numberValue,
        testObject.boolValue,
        testObject.stringValue,
        testObject.int64Value,
      ]);
    },

    "createMap().object contains every value type": (testObject) => {
      seedPrimitives(testObject);
      const values = [
        testObject.numberValue,
        testObject.boolValue,
        testObject.stringValue,
        testObject.int64Value,
      ];
      expect(testObject.createMap().object).to.deep.equal({
        array: [...values, values],
        int64: testObject.int64Value,
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
      expect([...keys].sort()).to.deep.equal(Object.keys(map).sort());
    },

    "mergeMaps(...) merges both maps": (testObject) => {
      expect(testObject.mergeMaps(TEST_MAP, TEST_MAP_2)).to.deep.equal({
        ...TEST_MAP,
        ...TEST_MAP_2,
      });
    },

    "copyAnyMap(...) returns an equal map": (testObject) => {
      expect(testObject.copyAnyMap(TEST_MAP_4)).to.deep.equal(TEST_MAP_4);
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
  ...casesForTestObjects("AnyMap values", {
    "mapRoundtrip(...) keeps a integer number value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[0]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a fractional number value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[1]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a true value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[2]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a false value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[3]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a string value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[4]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a empty string value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[5]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a null value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[6]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a bigint value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[7]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a negative bigint value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[8]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a empty array value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[9]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps a empty object value": (testObject) => {
      const [label, value] = ANY_MAP_VALUES[10]!;

      expect(testObject.mapRoundtrip({ value })).to.deep.equal({ value });
    },

    "mapRoundtrip(...) keeps the int64 boundaries as bigints": (testObject) => {
      expect(
        testObject.mapRoundtrip({ min: INT64_MIN, max: INT64_MAX }),
      ).to.deep.equal({ min: INT64_MIN, max: INT64_MAX });
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

    // TODO: Fix in Nitro - Swift `AnyValue.fromAny(...)` (packages/nitro-core/native/apple/core/AnyMap.swift) does not unwrap a nested `Optional<Any>.none` from `toAny()`, so on Swift copyAnyMap throws "Value Optional(nil) cannot be represented as AnyValue!"

    "copyAnyMap(...) keeps null inside arrays": (testObject) => {
      const map = { array: [null, 1, null] };
      expect(testObject.copyAnyMap(map)).to.deep.equal(map);
    },

    // TODO: Fix in Nitro - Swift `AnyValue.fromAny(...)` (packages/nitro-core/native/apple/core/AnyMap.swift) does not unwrap a nested `Optional<Any>.none` from `toAny()`, so on Swift copyAnyMap throws "Value Optional(nil) cannot be represented as AnyValue!"

    "copyAnyMap(...) keeps null inside objects": (testObject) => {
      const map = { object: { a: null, b: 1 } };
      expect(testObject.copyAnyMap(map)).to.deep.equal(map);
    },

    "copyAnyMap(...) keeps the int64 boundaries as bigints": (testObject) => {
      expect(
        testObject.copyAnyMap({ min: INT64_MIN, max: INT64_MAX }),
      ).to.deep.equal({ min: INT64_MIN, max: INT64_MAX });
    },

    "mapRoundtrip(...) returns a new object": (testObject) => {
      const map = { a: 1 };
      expect(Object.is(testObject.mapRoundtrip(map), map)).to.equal(false);
    },
  }),
  ...casesForTestObjects("AnyMap keys", {
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

    // TODO: Fix in Nitro - values of non-ASCII keys are read as undefined (`PropNameIDCache` uses `PropNameID::forAscii`), throws 'Cannot convert "undefined" to any type in variant<...>'
    // it('mapRoundtrip(...) keeps unicode keys', () => {
    //   const map = { '🔥': 1, 'ключ': 'значение', '日本語': true }
    //   expect(testObject.mapRoundtrip(map)).toStrictEqual(map)
    // })

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
  ...casesForTestObjects("AnyMap merging", {
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
        testObject.mergeMaps({ shared: 1 }, { shared: [1n, "one"] }),
      ).to.deep.equal({ shared: [1n, "one"] });
    },

    "mergeMaps(...) replaces nested objects instead of merging them": (
      testObject,
    ) => {
      expect(
        testObject.mergeMaps({ nested: { a: 1, b: 2 } }, { nested: { b: 3 } }),
      ).to.deep.equal({ nested: { b: 3 } });
    },
  }),
  ...casesForTestObjects("AnyMap conversion errors", {
    "mapRoundtrip(...) rejects a number": (testObject) => {
      // @ts-expect-error passing a number instead of an AnyMap
      expect(() => testObject.mapRoundtrip(5)).to.throw(
        `${testObject.name}.mapRoundtrip(...): Value is a number, expected an Object`,
      );
    },

    "mapRoundtrip(...) rejects undefined values": (testObject) => {
      // @ts-expect-error passing an undefined value
      expect(() => testObject.mapRoundtrip({ a: undefined })).to.throw(
        `${testObject.name}.mapRoundtrip(...): Cannot convert "undefined" to any type in variant<`,
      );
    },

    "mapRoundtrip(...) rejects undefined inside an array": (testObject) => {
      // @ts-expect-error passing an undefined array element
      expect(() => testObject.mapRoundtrip({ a: [1, undefined] })).to.throw(
        `${testObject.name}.mapRoundtrip(...): Cannot convert "undefined" to any type in variant<`,
      );
    },

    "mapRoundtrip(...) rejects function values": (testObject) => {
      // @ts-expect-error passing a function value
      const roundtrip = () => testObject.mapRoundtrip({ a: () => {} });
      expect(roundtrip).to.throw(
        `${testObject.name}.mapRoundtrip(...): Cannot convert "`,
      );
      expect(roundtrip).to.throw("to any type in variant<");
    },

    "mapRoundtrip(...) rejects ArrayBuffer values": (testObject) => {
      const roundtrip = () =>
        // @ts-expect-error passing an ArrayBuffer value
        testObject.mapRoundtrip({ a: new ArrayBuffer(8) });
      expect(roundtrip).to.throw(
        `${testObject.name}.mapRoundtrip(...): Cannot convert "[object ArrayBuffer]" to any type in variant<`,
      );
    },

    "mapRoundtrip(...) rejects a bigint beyond int64": (testObject) => {
      expect(() => testObject.mapRoundtrip({ a: INT64_MAX + 1n })).to.throw(
        `${testObject.name}.mapRoundtrip(...): Cannot convert "9223372036854775808" to any type in variant<`,
      );
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
        `${testObject.name}.bounceSimpleMap(...): Value is a number, expected an Object`,
      );
    },

    "bounceSimpleMap(...) rejects a string value": (testObject) => {
      // @ts-expect-error passing a string value
      expect(() => testObject.bounceSimpleMap({ a: 1, b: "2" })).to.throw(
        `${testObject.name}.bounceSimpleMap(...): Value is a string, expected a number`,
      );
    },

    "bounceMap(...) rejects a string value": (testObject) => {
      // @ts-expect-error passing a string value
      expect(() => testObject.bounceMap({ a: "yes" })).to.throw(
        `${testObject.name}.bounceMap(...): Cannot convert "yes" to any type in variant<`,
      );
    },

    "bounceOptionalMap(...) rejects null values": (testObject) => {
      // @ts-expect-error passing null where only undefined is optional
      expect(() => testObject.bounceOptionalMap({ a: null })).to.throw(
        `${testObject.name}.bounceOptionalMap(...): Value is null, expected a String`,
      );
    },

    "bounceNullMap(...) rejects undefined values": (testObject) => {
      // @ts-expect-error passing undefined where only null is allowed
      expect(() => testObject.bounceNullMap({ a: undefined })).to.throw(
        `${testObject.name}.bounceNullMap(...): Cannot convert "undefined" to any type in variant<`,
      );
    },

    "extractMap(...) rejects a missing secondMap": (testObject) => {
      // @ts-expect-error passing a MapWrapper without secondMap
      expect(() => testObject.extractMap({ map: {} })).to.throw(
        `${testObject.name}.extractMap(...): Value is undefined, expected an Object`,
      );
    },
  }),
};

export const skips = {
  "AnyMap values / TestObjectSwiftKotlin / copyAnyMap(...) keeps null inside arrays":
    {
      ios: 'Fix in Nitro - Swift `AnyValue.fromAny(...)` (packages/nitro-core/native/apple/core/AnyMap.swift) does not unwrap a nested `Optional<Any>.none` from `toAny()`, so on Swift copyAnyMap throws "Value Optional(nil) cannot be represented as AnyValue!"',
    },
  "AnyMap values / TestObjectSwiftKotlin / copyAnyMap(...) keeps null inside objects":
    {
      ios: 'Fix in Nitro - Swift `AnyValue.fromAny(...)` (packages/nitro-core/native/apple/core/AnyMap.swift) does not unwrap a nested `Optional<Any>.none` from `toAny()`, so on Swift copyAnyMap throws "Value Optional(nil) cannot be represented as AnyValue!"',
    },
} as const;
