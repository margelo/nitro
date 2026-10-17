import { expect } from "chai";
import { casesForTestObjects, recordCallback, waitFor } from "./utils/cases";

import { OldEnum } from "../specs/TestObject.nitro";
import { debugOnly } from "./utils/helpers";

const TRUCK_POWERTRAINS = ["electric", "gas", "hybrid", "diesel"] as const;
export const cases = {
  ...casesForTestObjects("Nullability & optional properties", {
    "stringOrUndefined roundtrips a string and undefined": (testObject) => {
      testObject.stringOrUndefined = "hello";
      expect(Object.is(testObject.stringOrUndefined, "hello")).to.equal(true);
      testObject.stringOrUndefined = undefined;
      expect(testObject.stringOrUndefined).to.equal(undefined);
    },

    "stringOrUndefined setter throws for null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.stringOrUndefined = null;
      }).to.throw(`${testObject.name}.stringOrUndefined`);
    },

    "optionalString roundtrips a string and undefined": (testObject) => {
      testObject.optionalString = "hello";
      expect(Object.is(testObject.optionalString, "hello")).to.equal(true);
      testObject.optionalString = undefined;
      expect(testObject.optionalString).to.equal(undefined);
    },

    "nullValue roundtrips null": (testObject) => {
      expect(testObject.nullValue).to.equal(null);
      testObject.nullValue = null;
      expect(testObject.nullValue).to.equal(null);
    },

    "nullValue setter throws for undefined": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.nullValue = undefined;
      }).to.throw(`${testObject.name}.nullValue`);
    },

    "nullValue setter throws for a number": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.nullValue = 19;
      }).to.throw(`${testObject.name}.nullValue`);
    },

    "stringOrNull roundtrips a string and null": (testObject) => {
      testObject.stringOrNull = "hello";
      expect(Object.is(testObject.stringOrNull, "hello")).to.equal(true);
      testObject.stringOrNull = null;
      expect(testObject.stringOrNull).to.equal(null);
    },

    "optionalArray roundtrips undefined": (testObject) => {
      testObject.optionalArray = undefined;
      expect(testObject.optionalArray).to.equal(undefined);
    },

    "optionalArray roundtrips an array": (testObject) => {
      testObject.optionalArray = ["hello", "world"];
      expect(testObject.optionalArray).to.deep.equal(["hello", "world"]);
    },

    "optionalHybrid roundtrips undefined": (testObject) => {
      testObject.optionalHybrid = undefined;
      expect(testObject.optionalHybrid).to.equal(undefined);
    },

    "optionalHybrid roundtrips the same HybridObject": (testObject) => {
      try {
        testObject.optionalHybrid = testObject;
        expect(Object.is(testObject.optionalHybrid, testObject)).to.equal(true);
      } finally {
        // Break the reference cycle (testObject holding itself)
        testObject.optionalHybrid = undefined;
      }
    },

    "optionalEnum roundtrips undefined": (testObject) => {
      testObject.optionalEnum = undefined;
      expect(testObject.optionalEnum).to.equal(undefined);
    },

    "optionalEnum roundtrips a value": (testObject) => {
      testObject.optionalEnum = "gas";
      expect(Object.is(testObject.optionalEnum, "gas")).to.equal(true);
    },

    "optionalOldEnum roundtrips undefined": (testObject) => {
      testObject.optionalOldEnum = undefined;
      expect(testObject.optionalOldEnum).to.equal(undefined);
    },

    "optionalOldEnum roundtrips a value": (testObject) => {
      testObject.optionalOldEnum = OldEnum.SECOND;
      expect(Object.is(testObject.optionalOldEnum, OldEnum.SECOND)).to.equal(
        true,
      );
    },

    "optionalCallback roundtrips a function and undefined": (testObject) => {
      testObject.optionalCallback = () => {};
      expect(testObject.optionalCallback).to.be.a("function");
      testObject.optionalCallback = undefined;
      expect(testObject.optionalCallback).to.equal(undefined);
    },
  }),
  ...casesForTestObjects("Optional parameters & argument-count validation", {
    "tryOptionalParams(...) with the optional param omitted": (testObject) => {
      expect(
        Object.is(testObject.tryOptionalParams(13, true), "value omitted!"),
      ).to.equal(true);
    },

    "tryOptionalParams(...) with the optional param provided": (testObject) => {
      expect(
        Object.is(testObject.tryOptionalParams(13, true, "hello"), "hello"),
      ).to.equal(true);
    },

    "tryOptionalParams(...) throws for one argument too many": (testObject) => {
      expect(() =>
        testObject.tryOptionalParams(
          13,
          true,
          "hello",
          // @ts-expect-error
          "too many args!",
        ),
      ).to.throw(
        `\`${testObject.name}.tryOptionalParams(...)\` expected between 2 and 3 arguments, but received 4!`,
      );
    },

    "tryOptionalParams(...) throws for one argument too few": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalParams(13)).to.throw(
        `\`${testObject.name}.tryOptionalParams(...)\` expected between 2 and 3 arguments, but received 1!`,
      );
    },

    "tryMiddleParam(...) with undefined in the middle": (testObject) => {
      expect(
        Object.is(testObject.tryMiddleParam(13, undefined, "hello!"), "hello!"),
      ).to.equal(true);
    },

    "tryMiddleParam(...) with true in the middle": (testObject) => {
      expect(
        Object.is(testObject.tryMiddleParam(13, true, "passed"), "passed"),
      ).to.equal(true);
    },

    "tryOptionalEnum(...) with a value": (testObject) => {
      expect(Object.is(testObject.tryOptionalEnum("gas"), "gas")).to.equal(
        true,
      );
    },

    "tryOptionalEnum(...) with undefined": (testObject) => {
      expect(testObject.tryOptionalEnum(undefined)).to.equal(undefined);
    },

    "tryTrailingOptional(...) with false": (testObject) => {
      expect(
        Object.is(testObject.tryTrailingOptional(0, "", false), false),
      ).to.equal(true);
    },

    "tryTrailingOptional(...) with true": (testObject) => {
      expect(
        Object.is(testObject.tryTrailingOptional(0, "", true), true),
      ).to.equal(true);
    },

    "tryOptionalParams(...) treats an explicit undefined as omitted": (
      testObject,
    ) => {
      expect(
        Object.is(
          testObject.tryOptionalParams(13, true, undefined),
          "value omitted!",
        ),
      ).to.equal(true);
    },

    "tryOptionalParams(...) keeps an empty string": (testObject) => {
      expect(
        Object.is(testObject.tryOptionalParams(13, true, ""), ""),
      ).to.equal(true);
    },

    "tryOptionalParams(...) throws for null as the optional param": (
      testObject,
    ) => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalParams(13, true, null)).to.throw(
        `${testObject.name}.tryOptionalParams(...): Value is null, expected a String`,
      );
    },

    "tryMiddleParam(...) throws when the last param is omitted": (
      testObject,
    ) => {
      // A middle optional param does not make the params after it optional
      // @ts-expect-error
      expect(() => testObject.tryMiddleParam(13, undefined)).to.throw(
        `\`${testObject.name}.tryMiddleParam(...)\` expected 3 arguments, but received 2!`,
      );
    },

    "tryOptionalEnum() with no arguments returns undefined": (testObject) => {
      expect(testObject.tryOptionalEnum()).to.equal(undefined);
    },

    "tryOptionalEnum(...) throws for an invalid enum value": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalEnum("diesel")).to.throw(
        `${testObject.name}.tryOptionalEnum(...): Cannot convert "diesel" to enum Powertrain - invalid value!`,
      );
    },

    "tryOptionalEnum(...) throws for two arguments": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalEnum("gas", "gas")).to.throw(
        `\`${testObject.name}.tryOptionalEnum(...)\` expected between 0 and 1 arguments, but received 2!`,
      );
    },

    "tryTrailingOptional(...) returns false with the optional param omitted": (
      testObject,
    ) => {
      expect(Object.is(testObject.tryTrailingOptional(0, ""), false)).to.equal(
        true,
      );
    },

    "tryTrailingOptional(...) throws for one argument": (testObject) => {
      // @ts-expect-error
      expect(() => testObject.tryTrailingOptional(0)).to.throw(
        `\`${testObject.name}.tryTrailingOptional(...)\` expected between 2 and 3 arguments, but received 1!`,
      );
    },
  }),
  ...casesForTestObjects("optionalEnumPlusOne", {
    "optionalEnumPlusOne roundtrips 'electric'": (testObject) => {
      const value = TRUCK_POWERTRAINS[0]!;

      testObject.optionalEnumPlusOne = value;
      expect(Object.is(testObject.optionalEnumPlusOne, value)).to.equal(true);
    },

    "optionalEnumPlusOne roundtrips 'gas'": (testObject) => {
      const value = TRUCK_POWERTRAINS[1]!;

      testObject.optionalEnumPlusOne = value;
      expect(Object.is(testObject.optionalEnumPlusOne, value)).to.equal(true);
    },

    "optionalEnumPlusOne roundtrips 'hybrid'": (testObject) => {
      const value = TRUCK_POWERTRAINS[2]!;

      testObject.optionalEnumPlusOne = value;
      expect(Object.is(testObject.optionalEnumPlusOne, value)).to.equal(true);
    },

    "optionalEnumPlusOne roundtrips 'diesel'": (testObject) => {
      const value = TRUCK_POWERTRAINS[3]!;

      testObject.optionalEnumPlusOne = value;
      expect(Object.is(testObject.optionalEnumPlusOne, value)).to.equal(true);
    },

    "optionalEnumPlusOne roundtrips undefined": (testObject) => {
      testObject.optionalEnumPlusOne = "diesel";
      testObject.optionalEnumPlusOne = undefined;
      expect(testObject.optionalEnumPlusOne).to.equal(undefined);
    },

    "optionalEnumPlusOne setter throws for a value outside the union": (
      testObject,
    ) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnumPlusOne = "petrol";
      }).to.throw(
        `${testObject.name}.optionalEnumPlusOne: Cannot convert "petrol" to enum TruckPowertrain - invalid value!`,
      );
    },

    "optionalEnumPlusOne setter is case-sensitive": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnumPlusOne = "Diesel";
      }).to.throw(
        `${testObject.name}.optionalEnumPlusOne: Cannot convert "Diesel" to enum TruckPowertrain - invalid value!`,
      );
    },

    "optionalEnum setter throws for the TruckPowertrain-only value": (
      testObject,
    ) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnum = "diesel";
      }).to.throw(
        `${testObject.name}.optionalEnum: Cannot convert "diesel" to enum Powertrain - invalid value!`,
      );
    },
  }),
  ...casesForTestObjects("Optional properties reject null", {
    "optionalString setter throws for null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalString = null;
      }).to.throw(
        `${testObject.name}.optionalString: Value is null, expected a String`,
      );
    },

    "optionalString keeps its value when the setter throws": (testObject) => {
      testObject.optionalString = "hello";
      expect(() => {
        // @ts-expect-error
        testObject.optionalString = null;
      }).to.throw();
      expect(Object.is(testObject.optionalString, "hello")).to.equal(true);
    },

    "optionalArray setter throws for null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalArray = null;
      }).to.throw(
        `${testObject.name}.optionalArray: Value is null, expected an Object`,
      );
    },

    "optionalEnum setter throws for null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnum = null;
      }).to.throw(
        `${testObject.name}.optionalEnum: Value is null, expected a String`,
      );
    },

    "optionalEnumPlusOne setter throws for null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalEnumPlusOne = null;
      }).to.throw(
        `${testObject.name}.optionalEnumPlusOne: Value is null, expected a String`,
      );
    },

    "optionalOldEnum setter throws for null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalOldEnum = null;
      }).to.throw(
        `${testObject.name}.optionalOldEnum: Value is null, expected a number`,
      );
    },

    "optionalCallback setter throws for null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalCallback = null;
      }).to.throw(
        `${testObject.name}.optionalCallback: Value is null, expected an Object`,
      );
    },

    "optionalHybrid setter throws for null": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.optionalHybrid = null;
      }).to.throw(
        `${testObject.name}.optionalHybrid: ${debugOnly('Cannot convert "null" to NativeState<')}`,
      );
    },

    "stringOrNull setter throws for undefined": (testObject) => {
      expect(() => {
        // @ts-expect-error
        testObject.stringOrNull = undefined;
      }).to.throw(
        `${testObject.name}.stringOrNull: Cannot convert "undefined" to any type in variant<`,
      );
    },
  }),
  ...casesForTestObjects("Optional properties keep falsy values", {
    "optionalString keeps an empty string": (testObject) => {
      testObject.optionalString = "";
      expect(Object.is(testObject.optionalString, "")).to.equal(true);
    },

    "stringOrUndefined keeps an empty string": (testObject) => {
      testObject.stringOrUndefined = "";
      expect(Object.is(testObject.stringOrUndefined, "")).to.equal(true);
    },

    "stringOrNull keeps an empty string": (testObject) => {
      testObject.stringOrNull = "";
      expect(Object.is(testObject.stringOrNull, "")).to.equal(true);
    },

    "optionalArray keeps an empty array": (testObject) => {
      testObject.optionalArray = [];
      expect(testObject.optionalArray).to.deep.equal([]);
    },

    "optionalOldEnum keeps OldEnum.FIRST (0)": (testObject) => {
      testObject.optionalOldEnum = OldEnum.FIRST;
      expect(Object.is(testObject.optionalOldEnum, OldEnum.FIRST)).to.equal(
        true,
      );
    },
  }),
  ...casesForTestObjects("optionalCallback getter", {
    "optionalCallback getter returns a function that calls the JS callback":
      async (testObject) => {
        const callback = recordCallback<(value: number) => void>();
        try {
          testObject.optionalCallback = callback;
          const forward = testObject.optionalCallback;
          expect(forward).to.be.a("function");
          forward?.(55);
          await waitFor(() => expect(callback.calls).to.deep.include([55]), {
            timeout: 2000,
          });
        } finally {
          testObject.optionalCallback = undefined;
        }
      },

    "optionalCallback getter returns a function that checks its argument count":
      (testObject) => {
        try {
          testObject.optionalCallback = () => {};
          const forward = testObject.optionalCallback;
          expect(forward).to.be.a("function");
          // @ts-expect-error
          expect(() => forward?.()).to.throw(
            "Function expected 1 arguments, but received 0!",
          );
        } finally {
          testObject.optionalCallback = undefined;
        }
      },
  }),
};
