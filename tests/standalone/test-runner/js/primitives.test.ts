import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

import { debugOnly } from "./utils/helpers";

const INT64_MAX = 9223372036854775807n;
// 2^63 - 1
const INT64_MIN = -9223372036854775808n;
// -(2^63)
const UINT64_MAX = 18446744073709551615n;
// 2^64 - 1
const ONE_MIB = 1024 * 1024;
export const cases = {
  ...casesForTestObjects("Primitive properties", {
    "numberValue roundtrips": (testObject) => {
      testObject.numberValue = 13;
      expect(Object.is(testObject.numberValue, 13)).to.equal(true);
      testObject.numberValue = 14;
      expect(Object.is(testObject.numberValue, 14)).to.equal(true);
    },

    "boolValue roundtrips": (testObject) => {
      testObject.boolValue = false;
      expect(Object.is(testObject.boolValue, false)).to.equal(true);
      testObject.boolValue = true;
      expect(Object.is(testObject.boolValue, true)).to.equal(true);
    },

    "stringValue roundtrips": (testObject) => {
      testObject.stringValue = "hello!";
      expect(Object.is(testObject.stringValue, "hello!")).to.equal(true);
    },

    "int64Value roundtrips a positive BigInt": (testObject) => {
      testObject.int64Value = 7362572367826385n;
      expect(Object.is(testObject.int64Value, 7362572367826385n)).to.equal(
        true,
      );
    },

    "int64Value roundtrips a negative BigInt": (testObject) => {
      testObject.int64Value = -7362572367826385n;
      expect(Object.is(testObject.int64Value, -7362572367826385n)).to.equal(
        true,
      );
    },

    "uint64Value roundtrips a positive BigInt": (testObject) => {
      testObject.uint64Value = 7362572367826385n;
      expect(Object.is(testObject.uint64Value, 7362572367826385n)).to.equal(
        true,
      );
    },

    "uint64Value setter throws for a negative BigInt": (testObject) => {
      expect(() => {
        testObject.uint64Value = -7362572367826385n;
      }).to.throw(
        `${testObject.constructor.name}.uint64Value: Lossy truncation in BigInt64::asUint64`,
      );
    },
  }),
  ...casesForTestObjects("is*/has* accessor naming", {
    "hasBoolean is false": (testObject) => {
      expect(Object.is(testObject.hasBoolean, false)).to.equal(true);
    },

    "hasBooleanWritable roundtrips": (testObject) => {
      testObject.hasBooleanWritable = true;
      expect(Object.is(testObject.hasBooleanWritable, true)).to.equal(true);
    },

    "isBoolean is false": (testObject) => {
      expect(Object.is(testObject.isBoolean, false)).to.equal(true);
    },

    "isBooleanWritable roundtrips": (testObject) => {
      testObject.isBooleanWritable = true;
      expect(Object.is(testObject.isBooleanWritable, true)).to.equal(true);
    },

    "isolatedBoolean roundtrips": (testObject) => {
      testObject.isolatedBoolean = true;
      expect(Object.is(testObject.isolatedBoolean, true)).to.equal(true);
    },

    "isTextValue roundtrips": (testObject) => {
      testObject.isTextValue = "hello";
      expect(Object.is(testObject.isTextValue, "hello")).to.equal(true);
    },
  }),
  ...casesForTestObjects("Basic functions", {
    "addNumbers(5, 13) returns 18": (testObject) => {
      expect(Object.is(testObject.addNumbers(5, 13), 18)).to.equal(true);
    },

    'addStrings("hello ", "world") returns "hello world"': (testObject) => {
      expect(
        Object.is(testObject.addStrings("hello ", "world"), "hello world"),
      ).to.equal(true);
    },

    "simpleFunc() returns undefined": (testObject) => {
      expect(testObject.simpleFunc()).to.equal(undefined);
    },

    "multipleArguments(...) returns undefined": (testObject) => {
      expect(testObject.multipleArguments(13, "hello!", true)).to.equal(
        undefined,
      );
    },

    "bounceNull(null) returns null": (testObject) => {
      expect(testObject.bounceNull(null)).to.equal(null);
    },

    "bounceNull(undefined) throws": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.bounceNull(undefined)).to.throw(
        `${testObject.constructor.name}.bounceNull(...)`,
      );
    },
  }),
  ...casesForTestObjects("Number edge cases", {
    "numberValue roundtrips NaN": (testObject) => {
      testObject.numberValue = NaN;
      expect(testObject.numberValue).to.be.NaN;
    },

    "numberValue roundtrips Infinity": (testObject) => {
      testObject.numberValue = Infinity;
      expect(Object.is(testObject.numberValue, Infinity)).to.equal(true);
    },

    "numberValue roundtrips -Infinity": (testObject) => {
      testObject.numberValue = -Infinity;
      expect(Object.is(testObject.numberValue, -Infinity)).to.equal(true);
    },

    "numberValue keeps the sign of -0": (testObject) => {
      testObject.numberValue = -0;
      expect(Object.is(testObject.numberValue, -0)).to.equal(true);
    },

    "numberValue roundtrips Number.MAX_VALUE": (testObject) => {
      testObject.numberValue = Number.MAX_VALUE;
      expect(Object.is(testObject.numberValue, Number.MAX_VALUE)).to.equal(
        true,
      );
    },

    "numberValue roundtrips the subnormal Number.MIN_VALUE": (testObject) => {
      testObject.numberValue = Number.MIN_VALUE;
      expect(Object.is(testObject.numberValue, Number.MIN_VALUE)).to.equal(
        true,
      );
    },

    "numberValue roundtrips Number.MAX_SAFE_INTEGER": (testObject) => {
      testObject.numberValue = Number.MAX_SAFE_INTEGER;
      expect(
        Object.is(testObject.numberValue, Number.MAX_SAFE_INTEGER),
      ).to.equal(true);
    },

    "numberValue roundtrips 2^64 without integer truncation": (testObject) => {
      testObject.numberValue = 2 ** 64;
      expect(Object.is(testObject.numberValue, 2 ** 64)).to.equal(true);
    },

    "numberValue keeps full double precision": (testObject) => {
      testObject.numberValue = 1 / 3;
      expect(Object.is(testObject.numberValue, 1 / 3)).to.equal(true);
    },

    "addNumbers(0.1, 0.2) matches JS double addition": (testObject) => {
      expect(Object.is(testObject.addNumbers(0.1, 0.2), 0.1 + 0.2)).to.equal(
        true,
      );
    },

    "addNumbers(-0, -0) returns -0": (testObject) => {
      expect(Object.is(testObject.addNumbers(-0, -0), -0)).to.equal(true);
    },

    "addNumbers(Infinity, -Infinity) returns NaN": (testObject) => {
      expect(testObject.addNumbers(Infinity, -Infinity)).to.be.NaN;
    },

    "addNumbers(NaN, 1) returns NaN": (testObject) => {
      expect(testObject.addNumbers(NaN, 1)).to.be.NaN;
    },

    "addNumbers(MAX_VALUE, MAX_VALUE) overflows to Infinity": (testObject) => {
      expect(
        Object.is(
          testObject.addNumbers(Number.MAX_VALUE, Number.MAX_VALUE),
          Infinity,
        ),
      ).to.equal(true);
    },

    "addNumbers(MIN_VALUE, MIN_VALUE) does not flush subnormals to 0": (
      testObject,
    ) => {
      expect(
        Object.is(
          testObject.addNumbers(Number.MIN_VALUE, Number.MIN_VALUE),
          Number.MIN_VALUE * 2,
        ),
      ).to.equal(true);
    },

    "addNumbers(MAX_SAFE_INTEGER, 2) rounds to 2^53": (testObject) => {
      expect(
        Object.is(testObject.addNumbers(Number.MAX_SAFE_INTEGER, 2), 2 ** 53),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("String edge cases", {
    "stringValue roundtrips an empty string": (testObject) => {
      testObject.stringValue = "hello!";
      testObject.stringValue = "";
      expect(Object.is(testObject.stringValue, "")).to.equal(true);
    },

    "stringValue roundtrips emoji (surrogate pairs and ZWJ sequences)": (
      testObject,
    ) => {
      testObject.stringValue = "👋🏽 🇦🇹 👨‍👩‍👧";
      expect(Object.is(testObject.stringValue, "👋🏽 🇦🇹 👨‍👩‍👧")).to.equal(true);
    },

    "stringValue roundtrips multi-byte UTF-8 text": (testObject) => {
      testObject.stringValue = "Grüße, 日本語, עברית";
      expect(
        Object.is(testObject.stringValue, "Grüße, 日本語, עברית"),
      ).to.equal(true);
    },

    "stringValue keeps combining characters unnormalized": (testObject) => {
      // "e" + COMBINING ACUTE ACCENT must not become the precomposed "\u00e9"
      testObject.stringValue = "e\u0301";
      expect(Object.is(testObject.stringValue, "e\u0301")).to.equal(true);
    },

    "stringValue roundtrips newlines and tabs": (testObject) => {
      testObject.stringValue = "line 1\nline 2\r\n\tindented";
      expect(
        Object.is(testObject.stringValue, "line 1\nline 2\r\n\tindented"),
      ).to.equal(true);
    },

    // TODO: Fix in Nitro - on Android the generated JNI code passes std::string to
    // Kotlin via jni::make_jstring(std::string), which uses c_str() and cuts the
    // string at the first '\0' (TestObjectSwiftKotlin.stringValue becomes 'before').

    "stringValue roundtrips an embedded NUL character": (testObject) => {
      testObject.stringValue = "before\0after";
      expect(Object.is(testObject.stringValue, "before\0after")).to.equal(true);
    },

    "stringValue roundtrips a 1 MiB string": (testObject) => {
      const largeString = "x".repeat(ONE_MIB);
      testObject.stringValue = largeString;
      const result = testObject.stringValue;
      // Compare the length first so a mismatch doesn't print 2 MiB of text
      expect(Object.is(result.length, ONE_MIB)).to.equal(true);
      expect(Object.is(result, largeString)).to.equal(true);
    },

    "addStrings(...) concatenates emoji": (testObject) => {
      expect(Object.is(testObject.addStrings("👋🏽", "🇦🇹"), "👋🏽🇦🇹")).to.equal(
        true,
      );
    },

    'addStrings("", "") returns an empty string': (testObject) => {
      expect(Object.is(testObject.addStrings("", ""), "")).to.equal(true);
    },

    // TODO: Fix in Nitro - on Android jni::make_jstring(std::string) cuts both
    // arguments at the first '\0', so TestObjectSwiftKotlin returns 'a'.

    "addStrings(...) keeps NUL characters": (testObject) => {
      expect(Object.is(testObject.addStrings("a\0", "\0b"), "a\0\0b")).to.equal(
        true,
      );
    },
  }),
  ...casesForTestObjects("BigInt boundaries", {
    "int64Value roundtrips INT64_MAX": (testObject) => {
      testObject.int64Value = INT64_MAX;
      expect(Object.is(testObject.int64Value, INT64_MAX)).to.equal(true);
    },

    "int64Value roundtrips INT64_MIN": (testObject) => {
      testObject.int64Value = INT64_MIN;
      expect(Object.is(testObject.int64Value, INT64_MIN)).to.equal(true);
    },

    "int64Value roundtrips 0n": (testObject) => {
      testObject.int64Value = 5n;
      testObject.int64Value = 0n;
      expect(Object.is(testObject.int64Value, 0n)).to.equal(true);
    },

    "int64Value setter throws for INT64_MAX + 1n": (testObject) => {
      expect(() => {
        testObject.int64Value = INT64_MAX + 1n;
      }).to.throw(
        `${testObject.constructor.name}.int64Value: Lossy truncation in BigInt64::asInt64`,
      );
    },

    "int64Value setter throws for INT64_MIN - 1n": (testObject) => {
      expect(() => {
        testObject.int64Value = INT64_MIN - 1n;
      }).to.throw(
        `${testObject.constructor.name}.int64Value: Lossy truncation in BigInt64::asInt64`,
      );
    },

    "int64Value keeps its value when the setter throws": (testObject) => {
      testObject.int64Value = 42n;
      expect(() => {
        testObject.int64Value = INT64_MAX + 1n;
      }).to.throw();
      expect(Object.is(testObject.int64Value, 42n)).to.equal(true);
    },

    "uint64Value roundtrips UINT64_MAX": (testObject) => {
      testObject.uint64Value = UINT64_MAX;
      expect(Object.is(testObject.uint64Value, UINT64_MAX)).to.equal(true);
    },

    "uint64Value roundtrips values above INT64_MAX": (testObject) => {
      testObject.uint64Value = INT64_MAX + 1n;
      expect(Object.is(testObject.uint64Value, INT64_MAX + 1n)).to.equal(true);
    },

    "uint64Value roundtrips 0n": (testObject) => {
      testObject.uint64Value = 5n;
      testObject.uint64Value = 0n;
      expect(Object.is(testObject.uint64Value, 0n)).to.equal(true);
    },

    "uint64Value setter throws for UINT64_MAX + 1n": (testObject) => {
      expect(() => {
        testObject.uint64Value = UINT64_MAX + 1n;
      }).to.throw(
        `${testObject.constructor.name}.uint64Value: Lossy truncation in BigInt64::asUint64`,
      );
    },
  }),
  ...casesForTestObjects("Argument type validation", {
    "addNumbers(...) throws for a numeric string": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers("1", 2)).to.throw(
        `${testObject.constructor.name}.addNumbers(...): Value is a string, expected a number`,
      );
    },

    "addNumbers(...) throws for a BigInt": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers(1, 2n)).to.throw(
        `${testObject.constructor.name}.addNumbers(...): Value is a bigint, expected a number`,
      );
    },

    "addNumbers(...) throws for an explicit undefined": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers(1, undefined)).to.throw(
        `${testObject.constructor.name}.addNumbers(...): Value is undefined, expected a number`,
      );
    },

    "addStrings(...) throws for a number": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addStrings("a", 1)).to.throw(
        `${testObject.constructor.name}.addStrings(...): Value is a number, expected a String`,
      );
    },

    "multipleArguments(...) throws for a number instead of a boolean": (
      testObject,
    ) => {
      // @ts-expect-error
      expect(() => testObject.multipleArguments(13, "hello!", 1)).to.throw(
        `${testObject.constructor.name}.multipleArguments(...): Value is a number, expected a boolean`,
      );
    },

    "bounceNull(...) throws for a falsy non-null value": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.bounceNull(0)).to.throw(
        `${testObject.constructor.name}.bounceNull(...): Cannot convert non-null value to NullType!`,
      );
    },

    "numberValue setter throws for a numeric string": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.numberValue = "13";
      }).to.throw(
        `${testObject.constructor.name}.numberValue: Value is a string, expected a number`,
      );
    },

    "numberValue setter throws for a BigInt": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.numberValue = 13n;
      }).to.throw(
        `${testObject.constructor.name}.numberValue: Value is a bigint, expected a number`,
      );
    },

    "boolValue setter throws for a number instead of coercing it": (
      testObject,
    ) => {
      expect(() => {
        // @ts-expect-error
        testObject.boolValue = 1;
      }).to.throw(
        `${testObject.constructor.name}.boolValue: Value is a number, expected a boolean`,
      );
    },

    "stringValue setter throws for a number": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.stringValue = 13;
      }).to.throw(
        `${testObject.constructor.name}.stringValue: Value is a number, expected a String`,
      );
    },

    "int64Value setter throws for a number": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.int64Value = 13;
      }).to.throw(
        `${testObject.constructor.name}.int64Value: Value is a number, expected a BigInt`,
      );
    },

    "uint64Value setter throws for a number": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.uint64Value = 13;
      }).to.throw(
        `${testObject.constructor.name}.uint64Value: Value is a number, expected a BigInt`,
      );
    },
  }),
  ...casesForTestObjects("Argument count validation", {
    "addNumbers(...) throws for one argument": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers(1)).to.throw(
        `\`${testObject.constructor.name}.addNumbers(...)\` expected 2 arguments, but received 1!`,
      );
    },

    "addNumbers(...) throws for three arguments": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers(1, 2, 3)).to.throw(
        `\`${testObject.constructor.name}.addNumbers(...)\` expected 2 arguments, but received 3!`,
      );
    },

    "addNumbers() throws for no arguments": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers()).to.throw(
        `\`${testObject.constructor.name}.addNumbers(...)\` expected 2 arguments, but received 0!`,
      );
    },

    "addNumbers(...) checks the argument count before the types": (
      testObject,
    ) => {
      // @ts-expect-error
      expect(() => testObject.addNumbers("a")).to.throw(
        `\`${testObject.constructor.name}.addNumbers(...)\` expected 2 arguments, but received 1!`,
      );
    },

    "simpleFunc(...) throws for an unexpected argument": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.simpleFunc(1)).to.throw(
        `\`${testObject.constructor.name}.simpleFunc(...)\` expected 0 arguments, but received 1!`,
      );
    },

    "multipleArguments(...) throws for a missing argument": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.multipleArguments(13, "hello!")).to.throw(
        `\`${testObject.constructor.name}.multipleArguments(...)\` expected 3 arguments, but received 2!`,
      );
    },
  }),
};

export const skips = {
  "String edge cases / TestObjectSwiftKotlin / stringValue roundtrips an embedded NUL character":
    {
      android:
        "Fix in Nitro - on Android the generated JNI code passes std::string to Kotlin via jni::make_jstring(std::string), which uses c_str() and cuts the string at the first '\\0' (TestObjectSwiftKotlin.stringValue becomes 'before').",
    },
  "String edge cases / TestObjectSwiftKotlin / addStrings(...) keeps NUL characters":
    {
      android:
        "Fix in Nitro - on Android jni::make_jstring(std::string) cuts both arguments at the first '\\0', so TestObjectSwiftKotlin returns 'a'.",
    },
} as const;
