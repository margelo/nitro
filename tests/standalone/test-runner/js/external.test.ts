import { expect } from "chai";
import { casesForTestObjects, namedCases, recordCallback } from "./utils/cases";

import { NitroModules } from "nitro-core";
import { Base, SizeUnit, type Size } from "nitro-test";
import {
  Base as ExternalBase,
  SizeUnit as ExternalSizeUnit,
  type Size as ExternalSize,
} from "nitro-test-external";
import { HybridSomeExternalObject } from "./utils/testObjects";

import { debugOnly } from "./utils/helpers";

const INT64_MIN = -(2n ** 63n);

const INT64_MAX = 2n ** 63n - 1n;

const UINT64_MAX = 2n ** 64n - 1n;

const LOCAL_SIZE: Size = {
  width: 640,
  height: 480,
  unit: SizeUnit.Pixels,
};

const EXTERNAL_SIZE: ExternalSize = {
  width: 1920,
  height: 1080,
  unit: ExternalSizeUnit.Pixels,
  scale: 2,
};

export const cases = {
  ...namedCases("Namespaced HybridObjects", {
    "same-named exports construct their own native implementations": () => {
      expect(Base).not.to.equal(ExternalBase);
      expect(new Base().baseValue).to.equal(10);
      expect(new ExternalBase().baseValue).to.equal(20);
    },

    "registry lookups return each package's exported constructor": () => {
      expect(NitroModules.getHybridClass<typeof Base>("test.Base")).to.equal(
        Base,
      );
      expect(
        NitroModules.getHybridClass<typeof ExternalBase>("test.external.Base"),
      ).to.equal(ExternalBase);
      expect(NitroModules.hasHybridClass("Base")).to.equal(false);
    },

    "same-named classes have independent prototypes": () => {
      const local = new Base();
      const external = new ExternalBase();
      expect(local).to.be.instanceOf(Base);
      expect(local).not.to.be.instanceOf(ExternalBase);
      expect(external).to.be.instanceOf(ExternalBase);
      expect(external).not.to.be.instanceOf(Base);
    },

    "constructor names and object descriptions stay unqualified": () => {
      expect(Base.name).to.equal("Base");
      expect(ExternalBase.name).to.equal("Base");
      for (const object of [new Base(), new ExternalBase()]) {
        expect(object.constructor.name).to.equal("Base");
        expect(object.toString()).to.equal("[HybridObject Base]");
      }
    },
  }),
  ...namedCases("Namespaced custom types", {
    "same-named structs preserve each module's fields": () => {
      expect(new Base().bounceSize(LOCAL_SIZE)).to.deep.equal(LOCAL_SIZE);
      expect(new ExternalBase().bounceSize(EXTERNAL_SIZE)).to.deep.equal(
        EXTERNAL_SIZE,
      );
    },

    "same-named enums preserve each module's members and values": () => {
      const local = new Base();
      const external = new ExternalBase();
      expect(local.bounceSizeUnit(SizeUnit.Points)).to.equal(SizeUnit.Points);
      expect(local.bounceSizeUnit(SizeUnit.Pixels)).to.equal(SizeUnit.Pixels);
      expect(external.bounceSizeUnit(ExternalSizeUnit.Pixels)).to.equal(
        ExternalSizeUnit.Pixels,
      );
      expect(external.bounceSizeUnit(ExternalSizeUnit.Normalized)).to.equal(
        ExternalSizeUnit.Normalized,
      );
    },

    "callbacks and promises use their module's struct and enum": async () => {
      let localCalls = 0;
      let externalCalls = 0;
      const localResult: Size = {
        width: 320,
        height: 240,
        unit: SizeUnit.Points,
      };
      const externalResult: ExternalSize = {
        width: 1,
        height: 1,
        unit: ExternalSizeUnit.Normalized,
        scale: 3,
      };
      const [local, external] = await Promise.all([
        new Base().mapSize(LOCAL_SIZE, (size) => {
          localCalls += 1;
          expect(size).to.deep.equal(LOCAL_SIZE);
          return localResult;
        }),
        new ExternalBase().mapSize(EXTERNAL_SIZE, (size) => {
          externalCalls += 1;
          expect(size).to.deep.equal(EXTERNAL_SIZE);
          return externalResult;
        }),
      ]);
      expect(localCalls).to.equal(1);
      expect(externalCalls).to.equal(1);
      expect(local).to.deep.equal(localResult);
      expect(external).to.deep.equal(externalResult);
    },
  }),
  ...namedCases("SomeExternalObject optional primitives", {
    "createOptionalPrimitivesHolder(5) only sets optionalNumber": () => {
      expect(
        HybridSomeExternalObject.createOptionalPrimitivesHolder(5),
      ).to.deep.equal({
        optionalNumber: 5,
        optionalBoolean: undefined,
        optionalUInt64: undefined,
        optionalInt64: undefined,
      });
    },

    "createOptionalPrimitivesHolder(undefined, true) only sets optionalBoolean":
      () => {
        expect(
          HybridSomeExternalObject.createOptionalPrimitivesHolder(
            undefined,
            true,
          ),
        ).to.deep.equal({
          optionalNumber: undefined,
          optionalBoolean: true,
          optionalUInt64: undefined,
          optionalInt64: undefined,
        });
      },

    "createOptionalPrimitivesHolder() leaves every field undefined": () => {
      expect(
        HybridSomeExternalObject.createOptionalPrimitivesHolder(),
      ).to.deep.equal({
        optionalNumber: undefined,
        optionalBoolean: undefined,
        optionalUInt64: undefined,
        optionalInt64: undefined,
      });
    },

    "createOptionalPrimitivesHolder(5, true, 7n, 13n) sets every field": () => {
      expect(
        HybridSomeExternalObject.createOptionalPrimitivesHolder(
          5,
          true,
          7n,
          13n,
        ),
      ).to.deep.equal({
        optionalNumber: 5,
        optionalBoolean: true,
        optionalUInt64: 7n,
        optionalInt64: 13n,
      });
    },

    "createOptionalPrimitivesHolder(0, false, 0n, 0n) keeps falsy values":
      () => {
        expect(
          HybridSomeExternalObject.createOptionalPrimitivesHolder(
            0,
            false,
            0n,
            0n,
          ),
        ).to.deep.equal({
          optionalNumber: 0,
          optionalBoolean: false,
          optionalUInt64: 0n,
          optionalInt64: 0n,
        });
      },

    "createOptionalPrimitivesHolder(...) keeps UInt64 max and Int64 min":
      () => {
        const holder = HybridSomeExternalObject.createOptionalPrimitivesHolder(
          undefined,
          undefined,
          UINT64_MAX,
          INT64_MIN,
        );
        expect(Object.is(holder.optionalUInt64, UINT64_MAX)).to.equal(true);
        expect(Object.is(holder.optionalInt64, INT64_MIN)).to.equal(true);
      },

    "createOptionalPrimitivesHolder(...) keeps Int64 max": () => {
      expect(
        Object.is(
          HybridSomeExternalObject.createOptionalPrimitivesHolder(
            undefined,
            undefined,
            undefined,
            INT64_MAX,
          ).optionalInt64,
          INT64_MAX,
        ),
      ).to.equal(true);
    },
  }),
  ...namedCases("SomeExternalObject", {
    'getValue() returns "Hello world!"': () => {
      expect(
        Object.is(HybridSomeExternalObject.getValue(), "Hello world!"),
      ).to.equal(true);
    },

    'name is "SomeExternalObject"': () => {
      expect(
        Object.is(
          HybridSomeExternalObject.constructor.name,
          "SomeExternalObject",
        ),
      ).to.equal(true);
    },

    'toString() is "[HybridObject SomeExternalObject]"': () => {
      expect(
        Object.is(
          HybridSomeExternalObject.toString(),
          "[HybridObject SomeExternalObject]",
        ),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("External HybridObjects", {
    "bounceExternalHybrid(...) returns the same object": (testObject) => {
      expect(
        Object.is(
          testObject.bounceExternalHybrid(HybridSomeExternalObject),
          HybridSomeExternalObject,
        ),
      ).to.equal(true);
    },

    "bounceExternalStruct(...) returns the same struct": (testObject) => {
      const result = testObject.bounceExternalStruct({
        someExternal: HybridSomeExternalObject,
      });
      expect(Object.keys(result)).to.deep.equal(["someExternal"]);
      expect(Object.is(result.someExternal, HybridSomeExternalObject)).to.equal(
        true,
      );
    },

    "bounceExternalVariant(...) returns a string": (testObject) => {
      expect(
        Object.is(testObject.bounceExternalVariant("Hello!"), "Hello!"),
      ).to.equal(true);
    },

    "bounceExternalVariant(...) returns an external object": (testObject) => {
      expect(
        Object.is(
          testObject.bounceExternalVariant(HybridSomeExternalObject),
          HybridSomeExternalObject,
        ),
      ).to.equal(true);
    },

    "createExternalVariantFromFunc(...) returns the factory result": (
      testObject,
    ) => {
      const factory = () => HybridSomeExternalObject;
      expect(
        Object.is(
          testObject.createExternalVariantFromFunc(factory),
          HybridSomeExternalObject,
        ),
      ).to.equal(true);
    },

    "createInternalObject() returns a subclass that overrides getValue()": (
      testObject,
    ) => {
      const object = testObject.createInternalObject();
      expect(Object.is(object, HybridSomeExternalObject)).to.equal(false);
      expect(Object.is(object.getValue(), "This is overridden!")).to.equal(
        true,
      );
    },
  }),
  ...casesForTestObjects("External HybridObject subclasses", {
    'createInternalObject() is named "SomeExternalObject"': (testObject) => {
      expect(
        Object.is(
          testObject.createInternalObject().constructor.name,
          "SomeExternalObject",
        ),
      ).to.equal(true);
    },

    "createInternalObject() returns a new object every call": (testObject) => {
      expect(
        Object.is(
          testObject.createInternalObject(),
          testObject.createInternalObject(),
        ),
      ).to.equal(false);
    },

    "createInternalObject() implements createOptionalPrimitivesHolder(...)": (
      testObject,
    ) => {
      expect(
        testObject
          .createInternalObject()
          .createOptionalPrimitivesHolder(1.5, false, 2n, -3n),
      ).to.deep.equal({
        optionalNumber: 1.5,
        optionalBoolean: false,
        optionalUInt64: 2n,
        optionalInt64: -3n,
      });
    },

    "bounceExternalHybrid(createInternalObject()) returns the same object": (
      testObject,
    ) => {
      const internal = testObject.createInternalObject();
      expect(
        Object.is(testObject.bounceExternalHybrid(internal), internal),
      ).to.equal(true);
    },

    "bounceExternalVariant(createInternalObject()) returns the same object": (
      testObject,
    ) => {
      const internal = testObject.createInternalObject();
      expect(
        Object.is(testObject.bounceExternalVariant(internal), internal),
      ).to.equal(true);
    },

    "bounceExternalStruct(...) keeps an internal object": (testObject) => {
      const internal = testObject.createInternalObject();
      expect(
        Object.is(
          testObject.bounceExternalStruct({ someExternal: internal })
            .someExternal,
          internal,
        ),
      ).to.equal(true);
    },

    "createExternalVariantFromFunc(...) returns an internal object": (
      testObject,
    ) => {
      const internal = testObject.createInternalObject();
      expect(
        Object.is(
          testObject.createExternalVariantFromFunc(() => internal),
          internal,
        ),
      ).to.equal(true);
    },
  }),
  ...casesForTestObjects("External HybridObject conversions", {
    "createExternalVariantFromFunc(...) calls the factory once": (
      testObject,
    ) => {
      const factory = recordCallback(() => HybridSomeExternalObject);
      testObject.createExternalVariantFromFunc(factory);
      expect(factory.calls).to.have.length(1);
    },

    "bounceExternalVariant(number) throws": (testObject) => {
      // @ts-expect-error - a number is neither a string nor a SomeExternalObject
      expect(() => testObject.bounceExternalVariant(55)).to.throw(
        `${testObject.constructor.name}.bounceExternalVariant(...): Cannot convert "55" to any type in variant<${debugOnly("std::shared_ptr<margelo::nitro::test::external::HybridSomeExternalObjectSpec>, std::string>!")}`,
      );
    },

    "bounceExternalVariant(another HybridObject type) throws": (testObject) => {
      // @ts-expect-error - a TestObject is not a SomeExternalObject
      expect(() => testObject.bounceExternalVariant(testObject)).to.throw(
        `Cannot convert "[HybridObject ${testObject.constructor.name}]" to any type in variant<`,
      );
    },

    "bounceExternalHybrid(another HybridObject type) throws": (testObject) => {
      // @ts-expect-error - a TestObject is not a SomeExternalObject
      expect(() => testObject.bounceExternalHybrid(testObject)).to.throw(
        "Downcasting failed - It has a different NativeState<T>!",
      );
    },

    "bounceExternalHybrid({}) throws because it has no NativeState": (
      testObject,
    ) => {
      // @ts-expect-error - a plain object is not a SomeExternalObject
      const bouncePlainObject = () => testObject.bounceExternalHybrid({});
      expect(bouncePlainObject).to.throw(
        `${testObject.constructor.name}.bounceExternalHybrid(...)`,
      );
      expect(bouncePlainObject).to.throw("It does not have a NativeState!");
    },

    "bounceExternalStruct({}) throws for the missing object": (testObject) => {
      // @ts-expect-error - `someExternal` is missing
      expect(() => testObject.bounceExternalStruct({})).to.throw(
        "It is undefined!",
      );
    },
  }),
};

export const skips = {
  "External HybridObject conversions / TestObjectCpp / bounceExternalHybrid(another HybridObject type) throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "External HybridObject conversions / TestObjectSwiftKotlin / bounceExternalHybrid(another HybridObject type) throws":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "External HybridObject conversions / TestObjectCpp / bounceExternalHybrid({}) throws because it has no NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "External HybridObject conversions / TestObjectSwiftKotlin / bounceExternalHybrid({}) throws because it has no NativeState":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "External HybridObject conversions / TestObjectCpp / bounceExternalStruct({}) throws for the missing object":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
  "External HybridObject conversions / TestObjectSwiftKotlin / bounceExternalStruct({}) throws for the missing object":
    {
      release: "Existing main exclusion: IS_DEBUG",
    },
} as const;
