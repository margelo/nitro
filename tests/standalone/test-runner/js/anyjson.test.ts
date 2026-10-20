import { expect } from "chai";
import type { AnyJSON } from "nitro-core";
import { TestObjectCpp } from "nitro-test";
import {
  casesForTestObjects,
  namedCases,
  rejection,
  withTimeout,
} from "./utils/cases";

interface JSONTextCase {
  label: string;
  json: string;
  value: AnyJSON;
}

const JSON_TEXT_CASES: readonly JSONTextCase[] = [
  { label: "null", json: "null", value: null },
  { label: "true", json: "true", value: true },
  { label: "false", json: "false", value: false },
  { label: "zero", json: "0", value: 0 },
  { label: "negative integer", json: "-42", value: -42 },
  { label: "fraction", json: "-13.37", value: -13.37 },
  { label: "exponent", json: "1.25e3", value: 1250 },
  {
    label: "maximum safe integer",
    json: "9007199254740991",
    value: Number.MAX_SAFE_INTEGER,
  },
  { label: "small positive exponent", json: "1e-100", value: 1e-100 },
  { label: "large positive exponent", json: "1e100", value: 1e100 },
  {
    label: "whitespace around a scalar",
    json: " \n\t -12.5 \r\n",
    value: -12.5,
  },
  { label: "string", json: '"hello"', value: "hello" },
  { label: "empty string", json: '""', value: "" },
  { label: "empty array", json: "[]", value: [] },
  { label: "empty object", json: "{}", value: {} },
  {
    label: "unicode keys and values",
    json: '{"🔥":"日本語","ключ":"значение","escaped":"\\uD83D\\uDD25"}',
    value: { "🔥": "日本語", ключ: "значение", escaped: "🔥" },
  },
  {
    label: "lone high surrogate",
    json: '"\\uD800"',
    value: "\uD800",
  },
  {
    label: "lone low surrogate",
    json: '"\\uDFFF"',
    value: "\uDFFF",
  },
  {
    label: "lone surrogates in nested values and object keys",
    json: '{"\\uD800":{"value":"\\uDFFF","items":["\\uD800"]}}',
    value: { "\uD800": { value: "\uDFFF", items: ["\uD800"] } },
  },
  {
    label: "escaped characters",
    json: String.raw`"\"quoted\"\\path\n\r\t\b\f\u0000"`,
    value: '"quoted"\\path\n\r\t\b\f\u0000',
  },
  {
    label: "nested arrays and objects",
    json: '[null,true,1,"two",[],{},[{"nested":[false,{"empty":{},"array":[]}]}]]',
    value: [
      null,
      true,
      1,
      "two",
      [],
      {},
      [{ nested: [false, { empty: {}, array: [] }] }],
    ],
  },
];

const INVALID_JSON = [
  "",
  "{",
  "[1,]",
  '{"missing":}',
  '{"key":1} trailing',
  '"unterminated',
  '"raw\nnewline"',
  "undefined",
  "NaN",
  "Infinity",
];

const JSON_PARSE_ERROR =
  /JSON parse error|SyntaxError|unexpected|unterminated|invalid JSON/i;

async function expectJSONRejection(promise: Promise<AnyJSON>): Promise<void> {
  // A timeout rejects the test itself; it cannot become the expected rejection.
  const error = await withTimeout(rejection(promise));
  if (!(error instanceof Error)) {
    throw new Error("Expected a JSON parse Error from the native Promise");
  }
  expect(error.message).to.match(JSON_PARSE_ERROR);
}

export const cases = {
  ...casesForTestObjects("AnyJSON top-level values", {
    "mapRoundtrip(...) preserves every JSON kind, nesting and escapes": (
      testObject,
    ) => {
      for (const { label, value } of JSON_TEXT_CASES) {
        expect(testObject.mapRoundtrip(value), label).to.deep.equal(value);
      }
    },

    "copyAnyMap(...) preserves every JSON kind, nesting and escapes": (
      testObject,
    ) => {
      for (const { label, value } of JSON_TEXT_CASES) {
        expect(testObject.copyAnyMap(value), label).to.deep.equal(value);
      }
    },
  }),
  ...namedCases("C++ AnyJSON native text", {
    "createJSON(...) parses every JSON kind, nesting and escapes": () => {
      const testObject = new TestObjectCpp();
      for (const { label, json, value } of JSON_TEXT_CASES) {
        expect(testObject.createJSON(json), label).to.deep.equal(value);
      }
    },

    "createJSON(...) preserves negative zero from native text": () => {
      const testObject = new TestObjectCpp();
      expect(Object.is(testObject.createJSON("-0"), -0)).to.equal(true);
      // JSON.stringify normalizes -0 before mapRoundtrip receives it.
      expect(Object.is(testObject.mapRoundtrip(-0), 0)).to.equal(true);
    },

    "createJSONAsync(...) parses every JSON kind, nesting and escapes":
      async () => {
        const testObject = new TestObjectCpp();
        for (const { label, json, value } of JSON_TEXT_CASES) {
          const result = await withTimeout(testObject.createJSONAsync(json));
          expect(result, label).to.deep.equal(value);
        }
      },

    "createResolvedJSON(...) parses every JSON kind, nesting and escapes":
      async () => {
        const testObject = new TestObjectCpp();
        for (const { label, json, value } of JSON_TEXT_CASES) {
          const result = await withTimeout(testObject.createResolvedJSON(json));
          expect(result, label).to.deep.equal(value);
        }
      },

    "pending JSON promises parse every JSON kind, nesting and escapes":
      async () => {
        const testObject = new TestObjectCpp();
        for (const { label, json, value } of JSON_TEXT_CASES) {
          const promise = testObject.createPendingJSON();
          testObject.resolvePendingJSONOnWorker(json);
          expect(await withTimeout(promise), label).to.deep.equal(value);
        }
      },

    "createJSON(...) throws for malformed native JSON and remains usable":
      () => {
        const testObject = new TestObjectCpp();
        for (const json of INVALID_JSON) {
          expect(() => testObject.createJSON(json), json).to.throw(
            JSON_PARSE_ERROR,
          );
          expect(testObject.createJSON('{"valid":true}')).to.deep.equal({
            valid: true,
          });
        }
      },

    "createResolvedJSON(...) rejects malformed native JSON and remains usable":
      async () => {
        const testObject = new TestObjectCpp();
        for (const json of INVALID_JSON) {
          const promise = testObject.createResolvedJSON(json);
          expect(promise).to.be.instanceOf(Promise);
          await expectJSONRejection(promise);
          expect(
            await withTimeout(testObject.createResolvedJSON('{"valid":true}')),
          ).to.deep.equal({ valid: true });
        }
      },

    "createJSONAsync(...) rejects malformed native JSON and remains usable":
      async () => {
        const testObject = new TestObjectCpp();
        for (const json of INVALID_JSON) {
          const promise = testObject.createJSONAsync(json);
          expect(promise).to.be.instanceOf(Promise);
          await expectJSONRejection(promise);
          expect(
            await withTimeout(testObject.createJSONAsync('{"valid":true}')),
          ).to.deep.equal({ valid: true });
        }
      },

    "pending JSON promises reject malformed native JSON and remain usable":
      async () => {
        const testObject = new TestObjectCpp();
        for (const json of INVALID_JSON) {
          const promise = testObject.createPendingJSON();
          expect(promise).to.be.instanceOf(Promise);
          testObject.resolvePendingJSONOnWorker(json);
          await expectJSONRejection(promise);
          const validPromise = testObject.createPendingJSON();
          testObject.resolvePendingJSONOnWorker('{"valid":true}');
          expect(await withTimeout(validPromise)).to.deep.equal({
            valid: true,
          });
        }
      },

    "getMapKeys(...) rejects nonobjects": () => {
      const testObject = new TestObjectCpp();
      const nonobjects: AnyJSON[] = [null, true, 42, "text", []];
      for (const value of nonobjects) {
        expect(() => testObject.getMapKeys(value)).to.throw();
      }
      expect(testObject.getMapKeys({ valid: true })).to.deep.equal(["valid"]);
    },

    "mergeMaps(...) rejects nonobjects in either argument": () => {
      const testObject = new TestObjectCpp();
      const nonobjects: AnyJSON[] = [null, false, 42, "text", []];
      for (const value of nonobjects) {
        expect(() => testObject.mergeMaps(value, {})).to.throw();
        expect(() => testObject.mergeMaps({}, value)).to.throw();
      }
      expect(testObject.mergeMaps({ left: 1 }, { right: 2 })).to.deep.equal({
        left: 1,
        right: 2,
      });
    },

    "C++ object helpers reject lone surrogates accepted by JavaScript JSON":
      () => {
        const testObject = new TestObjectCpp();
        // nlohmann/json requires well-formed Unicode. JSON.stringify and
        // JSON.parse preserve these escapes, so core AnyJSON must preserve them too.
        const objects: AnyJSON[] = [
          { value: "\uD800" },
          { value: "\uDFFF" },
          { "\uD800": { nested: "\uDFFF" } },
        ];
        for (const object of objects) {
          expect(() => testObject.getMapKeys(object)).to.throw(/surrogate/i);
          expect(() => testObject.mergeMaps(object, {})).to.throw(/surrogate/i);
          expect(() => testObject.mergeMaps({}, object)).to.throw(/surrogate/i);
        }
        expect(testObject.getMapKeys({ valid: true })).to.deep.equal(["valid"]);
        expect(testObject.mergeMaps({ left: 1 }, { right: 2 })).to.deep.equal({
          left: 1,
          right: 2,
        });
      },

    "mergeMaps(...) replaces collisions with null, arrays and nested objects":
      () => {
        const testObject = new TestObjectCpp();
        const left = {
          keep: true,
          nullable: 1,
          array: [1, 2],
          nested: { old: true },
        };
        const right = {
          nullable: null,
          array: [3],
          nested: { replacement: true },
        };
        expect(testObject.mergeMaps(left, right)).to.deep.equal({
          keep: true,
          nullable: null,
          array: [3],
          nested: { replacement: true },
        });
        expect(left).to.deep.equal({
          keep: true,
          nullable: 1,
          array: [1, 2],
          nested: { old: true },
        });
        expect(right).to.deep.equal({
          nullable: null,
          array: [3],
          nested: { replacement: true },
        });
      },
  }),
};
