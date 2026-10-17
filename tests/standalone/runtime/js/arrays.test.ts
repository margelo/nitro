import { expect } from "chai";
import { casesForTestObjects, recordCallback, waitFor } from "./utils/cases";

import { type Powertrain } from "../specs/TestObject.nitro";
import { HybridChild } from "./utils/testObjects";

import { TEST_MAP, TEST_MAP_2 } from "./utils/fixtures";

import { type TestObject } from "./utils/testObjects";

/**
 * The size and the first, middle and last 16 bytes of `buffer`. The native
 * buffers are 10 MB - too large to compare (and print) byte by byte.
 */
function sampleBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const middle = Math.floor(bytes.length / 2);
  return {
    byteLength: buffer.byteLength,
    first: bytes.slice(0, 16),
    middle: bytes.slice(middle, middle + 16),
    last: bytes.slice(-16),
  };
}

// Calls every array method of the spec with an empty array.
const EMPTY_ARRAY_CALLS: ReadonlyArray<
  [method: string, call: (testObject: TestObject) => unknown[]]
> = [
  ["bounceNumbers", (testObject) => testObject.bounceNumbers([])],
  ["bounceStrings", (testObject) => testObject.bounceStrings([])],
  ["bounceStructs", (testObject) => testObject.bounceStructs([])],
  ["bounceNestedArray", (testObject) => testObject.bounceNestedArray([])],
  ["bounceEnums", (testObject) => testObject.bounceEnums([])],
  ["bounceHybridObjects", (testObject) => testObject.bounceHybridObjects([])],
  ["bounceFunctions", (testObject) => testObject.bounceFunctions([])],
  ["bounceMaps", (testObject) => testObject.bounceMaps([])],
  ["bouncePromises", (testObject) => testObject.bouncePromises([])],
  ["bounceArrayBuffers", (testObject) => testObject.bounceArrayBuffers([])],
  ["bounceOptionals", (testObject) => testObject.bounceOptionals([], [])],
  ["bounceNulls", (testObject) => testObject.bounceNulls([])],
  ["bounceOptionalNulls", (testObject) => testObject.bounceOptionalNulls([])],
];
export const cases = {
  ...casesForTestObjects("Arrays", {
    "bounceNumbers(...) returns the same numbers": (testObject) => {
      expect(testObject.bounceNumbers([1, 2, 13, 42])).to.deep.equal([
        1, 2, 13, 42,
      ]);
    },

    "bounceStrings(...) returns the same simple strings": (testObject) => {
      expect(testObject.bounceStrings(["hello", "world", "!"])).to.deep.equal([
        "hello",
        "world",
        "!",
      ]);
    },

    "bounceStrings(...) returns the same unicode/emoji strings": (
      testObject,
    ) => {
      expect(testObject.bounceStrings(["✨", "🔥", "🥳🥷🏼🥳"])).to.deep.equal([
        "✨",
        "🔥",
        "🥳🥷🏼🥳",
      ]);
    },

    "bounceOptionals(...) keeps undefined elements": (testObject) => {
      const result = testObject.bounceOptionals(
        ["hello", undefined, "world"],
        [new ArrayBuffer(16), undefined],
      );
      expect(result).to.deep.equal(["hello", undefined, "world"]);
    },

    "bounceNulls(...) keeps null elements": (testObject) => {
      expect(testObject.bounceNulls(["hello", null, "world"])).to.deep.equal([
        "hello",
        null,
        "world",
      ]);
    },

    "bounceOptionalNulls(...) keeps null and undefined elements": (
      testObject,
    ) => {
      expect(
        testObject.bounceOptionalNulls(["hello", null, undefined]),
      ).to.deep.equal(["hello", null, undefined]);
    },

    "bounceEnums(...) returns the same enum values": (testObject) => {
      expect(testObject.bounceEnums(["gas", "hybrid"])).to.deep.equal([
        "gas",
        "hybrid",
      ]);
    },

    "bounceStructs(...) returns the same structs": (testObject) => {
      const people = [
        { age: 24, name: "Marc" },
        { age: 5, name: "Ben" },
      ];
      expect(testObject.bounceStructs(people)).to.deep.equal([
        { age: 24, name: "Marc" },
        { age: 5, name: "Ben" },
      ]);
    },

    "bounceNestedArray(...) returns the same nested arrays": (testObject) => {
      const nested = [
        [
          { age: 24, name: "Marc" },
          { age: 5, name: "Ben" },
        ],
        [{ age: 30, name: "Anna" }],
        [],
      ];
      expect(testObject.bounceNestedArray(nested)).to.deep.equal([
        [
          { age: 24, name: "Marc" },
          { age: 5, name: "Ben" },
        ],
        [{ age: 30, name: "Anna" }],
        [],
      ]);
    },
  }),
  ...casesForTestObjects("Arrays of complex types", {
    "complexEnumCallback(...) calls back with the same enum array": async (
      testObject,
    ) => {
      const callback = recordCallback<(array: Powertrain[]) => void>();
      testObject.complexEnumCallback(["gas", "electric"], callback);
      await waitFor(() => expect(callback.calls).to.have.length(1), {
        timeout: 2000,
      });
      expect(callback.calls).to.deep.include([["gas", "electric"]]);
    },

    "bounceHybridObjects(...) returns the same HybridObjects in order": (
      testObject,
    ) => {
      const child = testObject.createChild();
      const bounced = testObject.bounceHybridObjects([
        HybridChild,
        child,
        HybridChild,
      ]);
      expect(bounced).to.have.length(3);
      expect(Object.is(bounced[0], HybridChild)).to.equal(true);
      expect(Object.is(bounced[1], child)).to.equal(true);
      expect(Object.is(bounced[2], HybridChild)).to.equal(true);
    },

    "bounceFunctions(...) returns callable functions": async (testObject) => {
      const first = recordCallback();
      const second = recordCallback();
      const bounced = testObject.bounceFunctions([first, second]);
      expect(bounced).to.have.length(2);
      for (const callback of bounced) expect(callback).to.be.a("function");

      for (const bouncedFunction of bounced) {
        bouncedFunction();
      }
      await waitFor(
        () => {
          expect(first.calls).to.have.length(1);
          expect(second.calls).to.have.length(1);
        },
        { timeout: 2000 },
      );
    },

    "bounceMaps(...) returns the same maps": (testObject) => {
      expect(testObject.bounceMaps([TEST_MAP, TEST_MAP_2])).to.deep.equal([
        TEST_MAP,
        TEST_MAP_2,
      ]);
    },

    "bouncePromises(...) returns promises with the same results": async (
      testObject,
    ) => {
      const bounced = testObject.bouncePromises([
        (async () => 55)(),
        Promise.resolve(13),
      ]);
      expect(bounced).to.have.length(2);
      for (const promise of bounced) expect(promise).to.be.instanceOf(Promise);
      await expect(await Promise.all(bounced)).to.deep.equal([55, 13]);
    },

    "bounceArrayBuffers(...) returns ArrayBuffers with the same bytes": (
      testObject,
    ) => {
      const jsBytes = Uint8Array.from({ length: 50 }, (_, i) => i + 1);
      const buffers = [
        testObject.createArrayBuffer(),
        testObject.createArrayBufferFromNativeBuffer(false),
        testObject.createArrayBufferFromNativeBuffer(true),
        jsBytes.buffer,
      ];
      const bounced = testObject.bounceArrayBuffers(buffers);
      expect(bounced).to.have.length(4);
      for (const buffer of bounced)
        expect(buffer).to.be.instanceOf(ArrayBuffer);
      expect(bounced.map(sampleBytes)).to.deep.equal(buffers.map(sampleBytes));
      expect(new Uint8Array(bounced[3]!)).to.deep.equal(jsBytes);
    },
  }),
  ...casesForTestObjects("Empty arrays", {
    "bounceNumbers(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[0]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceStrings(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[1]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceStructs(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[2]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceNestedArray(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[3]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceEnums(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[4]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceHybridObjects(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[5]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceFunctions(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[6]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceMaps(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[7]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bouncePromises(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[8]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceArrayBuffers(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[9]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceOptionals(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[10]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceNulls(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[11]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceOptionalNulls(...) returns an empty array for []": (testObject) => {
      const [method, call] = EMPTY_ARRAY_CALLS[12]!;

      expect(call(testObject)).to.deep.equal([]);
    },

    "bounceNestedArray(...) keeps empty inner arrays": (testObject) => {
      expect(testObject.bounceNestedArray([[], [], []])).to.deep.equal([
        [],
        [],
        [],
      ]);
    },

    "complexEnumCallback(...) calls back with an empty array": async (
      testObject,
    ) => {
      const callback = recordCallback<(array: Powertrain[]) => void>();
      testObject.complexEnumCallback([], callback);
      await waitFor(() => expect(callback.calls).to.have.length(1), {
        timeout: 2000,
      });
      expect(callback.calls).to.deep.include([[]]);
    },
  }),
  ...casesForTestObjects("Array values", {
    "bounceNumbers(...) returns a new array": (testObject) => {
      const numbers = [1, 2, 3];
      const result = testObject.bounceNumbers(numbers);
      expect(Object.is(result, numbers)).to.equal(false);
      expect(result).to.deep.equal(numbers);
    },

    "bounceNumbers(...) keeps -0": (testObject) => {
      expect(testObject.bounceNumbers([-0, 0])).to.deep.equal([-0, 0]);
    },

    "bounceNumbers(...) keeps NaN and Infinity": (testObject) => {
      expect(
        testObject.bounceNumbers([NaN, Infinity, -Infinity]),
      ).to.deep.equal([NaN, Infinity, -Infinity]);
    },

    "bounceNumbers(...) keeps extreme doubles": (testObject) => {
      const extremes = [
        Number.MAX_VALUE,
        -Number.MAX_VALUE,
        Number.MIN_VALUE,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.EPSILON,
        0.1 + 0.2,
      ];
      expect(testObject.bounceNumbers(extremes)).to.deep.equal(extremes);
    },

    "bounceNumbers(...) returns all 10,000 numbers": (testObject) => {
      const numbers = Array.from({ length: 10_000 }, (_, i) => i * 1.5 - 500);
      expect(testObject.bounceNumbers(numbers)).to.deep.equal(numbers);
    },

    "bounceStrings(...) returns all 10,000 strings": (testObject) => {
      const strings = Array.from({ length: 10_000 }, (_, i) => `string #${i}`);
      expect(testObject.bounceStrings(strings)).to.deep.equal(strings);
    },

    "bounceStrings(...) keeps empty strings": (testObject) => {
      expect(testObject.bounceStrings(["", "a", ""])).to.deep.equal([
        "",
        "a",
        "",
      ]);
    },

    // TODO: Fix in Nitro - bounceStrings(...) truncates strings at the first NUL on Kotlin (JHybridTestObjectSwiftKotlinSpec uses jni::make_jstring(std::string), which reads c_str()), so ['a\0b', '\0'] comes back as ['a', '']; C++ and Swift keep them

    "bounceStrings(...) keeps NUL characters": (testObject) => {
      expect(testObject.bounceStrings(["a\0b", "\0"])).to.deep.equal([
        "a\0b",
        "\0",
      ]);
    },

    "bounceStrings(...) keeps a 100,000 character string": (testObject) => {
      const long = "nitro🔥!".repeat(100_000 / 8);
      expect(testObject.bounceStrings([long])).to.deep.equal([long]);
    },

    "bounceStructs(...) returns all 1,000 structs": (testObject) => {
      const people = Array.from({ length: 1_000 }, (_, i) => ({
        name: `Person #${i}`,
        age: i,
      }));
      expect(testObject.bounceStructs(people)).to.deep.equal(people);
    },

    "bounceStructs(...) drops unknown keys of each element": (testObject) => {
      const person = { name: "Marc", age: 24, nickname: "mrousavy" };
      expect(testObject.bounceStructs([person])).to.deep.equal([
        { name: "Marc", age: 24 },
      ]);
    },

    "bounceEnums(...) keeps duplicates and their order": (testObject) => {
      expect(
        testObject.bounceEnums(["hybrid", "gas", "hybrid", "electric"]),
      ).to.deep.equal(["hybrid", "gas", "hybrid", "electric"]);
    },

    "bounceOptionals(...) keeps an array of only undefined": (testObject) => {
      expect(
        testObject.bounceOptionals([undefined, undefined], []),
      ).to.deep.equal([undefined, undefined]);
    },
  }),
  ...casesForTestObjects("Array conversion errors", {
    "bounceNumbers(...) rejects a number": (testObject) => {
      // @ts-expect-error passing a number instead of an array
      expect(() => testObject.bounceNumbers(5)).to.throw(
        `${testObject.name}.bounceNumbers(...): Value is a number, expected an Object`,
      );
    },

    "bounceNumbers(...) rejects undefined": (testObject) => {
      // @ts-expect-error passing undefined instead of an array
      expect(() => testObject.bounceNumbers(undefined)).to.throw(
        `${testObject.name}.bounceNumbers(...): Value is undefined, expected an Object`,
      );
    },

    "bounceNumbers(...) rejects an array-like object": (testObject) => {
      const arrayLike = { length: 2, 0: 1, 1: 2 };
      // @ts-expect-error passing an array-like object instead of an array
      expect(() => testObject.bounceNumbers(arrayLike)).to.throw(
        `${testObject.name}.bounceNumbers(...): Object is an object, expected an array`,
      );
    },

    "bounceNumbers(...) rejects a typed array": (testObject) => {
      const typedArray = new Float64Array([1, 2]);
      // @ts-expect-error passing a Float64Array instead of an array
      expect(() => testObject.bounceNumbers(typedArray)).to.throw(
        `${testObject.name}.bounceNumbers(...): Object is an object, expected an array`,
      );
    },

    "bounceNumbers(...) rejects a string element": (testObject) => {
      // @ts-expect-error passing a string element
      expect(() => testObject.bounceNumbers([1, "2"])).to.throw(
        `${testObject.name}.bounceNumbers(...): Value is a string, expected a number`,
      );
    },

    "bounceNumbers(...) rejects a bigint element": (testObject) => {
      // @ts-expect-error passing a bigint element
      expect(() => testObject.bounceNumbers([1, 2n])).to.throw(
        `${testObject.name}.bounceNumbers(...): Value is a bigint, expected a number`,
      );
    },

    "bounceStrings(...) rejects a number element": (testObject) => {
      // @ts-expect-error passing a number element
      expect(() => testObject.bounceStrings(["a", 5])).to.throw(
        `${testObject.name}.bounceStrings(...): Value is a number, expected a String`,
      );
    },

    "bounceStrings(...) rejects a null element": (testObject) => {
      // @ts-expect-error passing a null element
      expect(() => testObject.bounceStrings(["a", null])).to.throw(
        `${testObject.name}.bounceStrings(...): Value is null, expected a String`,
      );
    },

    "bounceEnums(...) rejects an unknown enum value": (testObject) => {
      // @ts-expect-error passing an unknown Powertrain
      expect(() => testObject.bounceEnums(["gas", "diesel"])).to.throw(
        `${testObject.name}.bounceEnums(...): Cannot convert "diesel" to enum Powertrain - invalid value!`,
      );
    },

    "bounceStructs(...) rejects an element with a missing field": (
      testObject,
    ) => {
      // @ts-expect-error passing a Person without an age
      expect(() => testObject.bounceStructs([{ name: "Marc" }])).to.throw(
        `${testObject.name}.bounceStructs(...): Value is undefined, expected a number`,
      );
    },

    "bounceStructs(...) rejects a non-object element": (testObject) => {
      // @ts-expect-error passing a string instead of a Person
      expect(() => testObject.bounceStructs(["Marc"])).to.throw(
        `${testObject.name}.bounceStructs(...): Value is a string, expected an Object`,
      );
    },

    "bounceNestedArray(...) rejects a struct instead of an inner array": (
      testObject,
    ) => {
      const person = { name: "Marc", age: 24 };
      // @ts-expect-error passing a Person instead of Person[]
      expect(() => testObject.bounceNestedArray([[person], person])).to.throw(
        `${testObject.name}.bounceNestedArray(...): Object is an object, expected an array`,
      );
    },

    "bounceOptionals(...) rejects null elements": (testObject) => {
      // @ts-expect-error passing null where only undefined is optional
      expect(() => testObject.bounceOptionals(["a", null], [])).to.throw(
        `${testObject.name}.bounceOptionals(...): Value is null, expected a String`,
      );
    },

    "bounceNulls(...) rejects undefined elements": (testObject) => {
      // @ts-expect-error passing undefined where only null is allowed
      expect(() => testObject.bounceNulls(["a", undefined])).to.throw(
        `${testObject.name}.bounceNulls(...): Cannot convert "undefined" to any type in variant<`,
      );
    },

    "bounceOptionalNulls(...) rejects a number element": (testObject) => {
      // @ts-expect-error passing a number element
      expect(() => testObject.bounceOptionalNulls(["a", 5])).to.throw(
        `${testObject.name}.bounceOptionalNulls(...): Cannot convert "5" to any type in variant<`,
      );
    },

    "bounceFunctions(...) rejects a non-function element": (testObject) => {
      // @ts-expect-error passing an object instead of a function
      expect(() => testObject.bounceFunctions([() => {}, {}])).to.throw(
        `${testObject.name}.bounceFunctions(...): Object is an object, expected a function`,
      );
    },
  }),
};

export const skips = {
  "Array values / TestObjectSwiftKotlin / bounceStrings(...) keeps NUL characters":
    {
      android:
        "Fix in Nitro - bounceStrings(...) truncates strings at the first NUL on Kotlin (JHybridTestObjectSwiftKotlinSpec uses jni::make_jstring(std::string), which reads c_str()), so ['a\\0b', '\\0'] comes back as ['a', '']; C++ and Swift keep them",
    },
} as const;
