import { expect } from "chai";
import { TestObjectCpp, TestObjectSwiftKotlin } from "nitro-test";
import { namedCases } from "./utils/cases";

type TestObjectConstructor =
  | typeof TestObjectCpp
  | typeof TestObjectSwiftKotlin;

function staticPropertyCases(Constructor: TestObjectConstructor) {
  return {
    "readonlyNumber cannot be changed": () => {
      expect(Constructor.readonlyNumber).to.equal(42);
      expect(Reflect.set(Constructor, "readonlyNumber", 1)).to.equal(false);
      try {
        // @ts-expect-error - the native property is read-only in TypeScript too.
        Constructor.readonlyNumber = 1;
      } catch (error) {
        // Strict JavaScript throws; non-strict JavaScript ignores the assignment.
        expect(error).to.be.instanceOf(TypeError);
      }
      expect(Constructor.readonlyNumber).to.equal(42);
    },

    "properties are non-enumerable, non-configurable accessors": () => {
      const readonly = Object.getOwnPropertyDescriptor(
        Constructor,
        "readonlyNumber",
      );
      const writable = Object.getOwnPropertyDescriptor(
        Constructor,
        "sharedNumber",
      );
      for (const descriptor of [readonly, writable]) {
        expect(descriptor).not.to.equal(undefined);
        expect(descriptor?.enumerable).to.equal(false);
        expect(descriptor?.configurable).to.equal(false);
        expect(descriptor?.get).to.be.a("function");
        expect(descriptor?.get?.length).to.equal(0);
        expect(descriptor).not.to.have.property("value");
      }
      expect(readonly?.set).to.equal(undefined);
      expect(writable?.set).to.be.a("function");
      expect(writable?.set?.length).to.equal(1);
    },

    "separate instances share the constructor's property": () => {
      const original = Constructor.sharedNumber;
      try {
        const first = new Constructor();
        const second = new Constructor();
        const firstConstructor = first.constructor as TestObjectConstructor;
        const secondConstructor = second.constructor as TestObjectConstructor;
        expect(Object.is(first, second)).to.equal(false);
        expect("sharedNumber" in first).to.equal(false);
        expect("readonlyNumber" in second).to.equal(false);

        Constructor.sharedNumber = 13;
        expect(firstConstructor.sharedNumber).to.equal(13);
        expect(secondConstructor.sharedNumber).to.equal(13);
        firstConstructor.sharedNumber = 29;
        expect(Constructor.sharedNumber).to.equal(29);
        expect(secondConstructor.sharedNumber).to.equal(29);
      } finally {
        Constructor.sharedNumber = original;
      }
    },

    "JavaScript subclasses inherit the same static storage": () => {
      class Subclass extends (Constructor as typeof TestObjectCpp) {}
      const original = Constructor.sharedNumber;
      try {
        expect(Subclass.readonlyNumber).to.equal(42);
        Subclass.sharedNumber = 17;
        expect(Constructor.sharedNumber).to.equal(17);
        Constructor.sharedNumber = 31;
        expect(Subclass.sharedNumber).to.equal(31);
        expect(Object.hasOwn(Subclass, "sharedNumber")).to.equal(false);
      } finally {
        Constructor.sharedNumber = original;
      }
    },

    "invalid values leave the writable property unchanged": () => {
      const original = Constructor.sharedNumber;
      try {
        Constructor.sharedNumber = 23;
        expect(() => {
          // @ts-expect-error - exercise native argument validation.
          Constructor.sharedNumber = "invalid";
        }).to.throw();
        expect(Constructor.sharedNumber).to.equal(23);
      } finally {
        Constructor.sharedNumber = original;
      }
    },
  };
}

export const cases = {
  ...namedCases(
    "Static properties / TestObjectCpp",
    staticPropertyCases(TestObjectCpp),
  ),
  ...namedCases(
    "Static properties / TestObjectSwiftKotlin",
    staticPropertyCases(TestObjectSwiftKotlin),
  ),
};
