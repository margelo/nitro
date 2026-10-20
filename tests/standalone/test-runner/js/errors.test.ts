import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches exactly `text`, not just a substring of the error message. */
function exactly(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}$`);
}

/** Matches a message whose first line is exactly `text`. */
function firstLine(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}(?:\\n|$)`);
}

/**
 * Matches the first line of an error thrown by a native method:
 * `<HybridObject name>.<method>(...): <native message>`.
 * Kotlin exceptions reach JS as `<java class>: <message>` followed by the
 * Java stack trace, so an optional class name may sit between the method
 * name and the native message, and anything after the first line is ignored.
 */
function nativeErrorMessage(
  objectName: string,
  method: string,
  message: string,
): RegExp {
  const prefix = escapeRegExp(`${objectName}.${method}(...): `);
  return new RegExp(
    `^${prefix}(?:[\\w.$]+: )?${escapeRegExp(message)}(?:\\n|$)`,
  );
}
export const cases = {
  ...casesForTestObjects("Errors", {
    "funcThatThrows() throws with the method name and message": (
      testObject,
    ) => {
      expect(() => testObject.funcThatThrows()).to.throw(
        `${testObject.constructor.name}.funcThatThrows(...):`,
      );
      expect(() => testObject.funcThatThrows()).to.throw(
        "This function will only work after sacrificing seven lambs!",
      );
    },

    "funcThatThrowsBeforePromise() throws before creating a Promise": (
      testObject,
    ) => {
      expect(() => testObject.funcThatThrowsBeforePromise()).to.throw(
        `${testObject.constructor.name}.funcThatThrowsBeforePromise(...):`,
      );
      expect(() => testObject.funcThatThrowsBeforePromise()).to.throw(
        "This function will only work after sacrificing eight lambs!",
      );
    },

    "throwError(error) rethrows the JS error message": (testObject) => {
      const error = new Error("rethrowing a JS error from native!");
      expect(() => testObject.throwError(error)).to.throw(
        `${testObject.constructor.name}.throwError(...):`,
      );
      // Native keeps the JS error's name, so `Error: ` is part of the message.
      expect(() => testObject.throwError(error)).to.throw(
        "Error: rethrowing a JS error from native!",
      );
    },

    'funcThatThrows(...) error message is "<name>.funcThatThrows(...): <native message>"':
      (testObject) => {
        const nativeErrors = [
          {
            method: "funcThatThrows",
            call: () => testObject.funcThatThrows(),
            message:
              "This function will only work after sacrificing seven lambs!",
          },
          {
            method: "funcThatThrowsBeforePromise",
            call: () => testObject.funcThatThrowsBeforePromise(),
            message:
              "This function will only work after sacrificing eight lambs!",
          },
          {
            method: "throwError",
            call: () =>
              testObject.throwError(
                new Error("rethrowing a JS error from native!"),
              ),
            message: "Error: rethrowing a JS error from native!",
          },
          {
            method: "castBase",
            call: () => testObject.castBase(testObject.createBase()),
            message: "Cannot cast Base to Child!",
          },
        ];
        const { method, call, message } = nativeErrors[0]!;

        expect(call).to.throw(
          nativeErrorMessage(testObject.constructor.name, method, message),
        );
      },

    'funcThatThrowsBeforePromise(...) error message is "<name>.funcThatThrowsBeforePromise(...): <native message>"':
      (testObject) => {
        const nativeErrors = [
          {
            method: "funcThatThrows",
            call: () => testObject.funcThatThrows(),
            message:
              "This function will only work after sacrificing seven lambs!",
          },
          {
            method: "funcThatThrowsBeforePromise",
            call: () => testObject.funcThatThrowsBeforePromise(),
            message:
              "This function will only work after sacrificing eight lambs!",
          },
          {
            method: "throwError",
            call: () =>
              testObject.throwError(
                new Error("rethrowing a JS error from native!"),
              ),
            message: "Error: rethrowing a JS error from native!",
          },
          {
            method: "castBase",
            call: () => testObject.castBase(testObject.createBase()),
            message: "Cannot cast Base to Child!",
          },
        ];
        const { method, call, message } = nativeErrors[1]!;

        expect(call).to.throw(
          nativeErrorMessage(testObject.constructor.name, method, message),
        );
      },

    'throwError(...) error message is "<name>.throwError(...): <native message>"':
      (testObject) => {
        const nativeErrors = [
          {
            method: "funcThatThrows",
            call: () => testObject.funcThatThrows(),
            message:
              "This function will only work after sacrificing seven lambs!",
          },
          {
            method: "funcThatThrowsBeforePromise",
            call: () => testObject.funcThatThrowsBeforePromise(),
            message:
              "This function will only work after sacrificing eight lambs!",
          },
          {
            method: "throwError",
            call: () =>
              testObject.throwError(
                new Error("rethrowing a JS error from native!"),
              ),
            message: "Error: rethrowing a JS error from native!",
          },
          {
            method: "castBase",
            call: () => testObject.castBase(testObject.createBase()),
            message: "Cannot cast Base to Child!",
          },
        ];
        const { method, call, message } = nativeErrors[2]!;

        expect(call).to.throw(
          nativeErrorMessage(testObject.constructor.name, method, message),
        );
      },

    'castBase(...) error message is "<name>.castBase(...): <native message>"': (
      testObject,
    ) => {
      const nativeErrors = [
        {
          method: "funcThatThrows",
          call: () => testObject.funcThatThrows(),
          message:
            "This function will only work after sacrificing seven lambs!",
        },
        {
          method: "funcThatThrowsBeforePromise",
          call: () => testObject.funcThatThrowsBeforePromise(),
          message:
            "This function will only work after sacrificing eight lambs!",
        },
        {
          method: "throwError",
          call: () =>
            testObject.throwError(
              new Error("rethrowing a JS error from native!"),
            ),
          message: "Error: rethrowing a JS error from native!",
        },
        {
          method: "castBase",
          call: () => testObject.castBase(testObject.createBase()),
          message: "Cannot cast Base to Child!",
        },
      ];
      const { method, call, message } = nativeErrors[3]!;

      expect(call).to.throw(
        nativeErrorMessage(testObject.constructor.name, method, message),
      );
    },

    "funcThatThrows() throws an Error instance": (testObject) => {
      expect(() => testObject.funcThatThrows()).to.throw(Error);
    },

    "throwError(...) keeps the name of a TypeError": (testObject) => {
      expect(() =>
        testObject.throwError(new TypeError("wrong type from JS")),
      ).to.throw("TypeError: wrong type from JS");
    },

    "throwError(...) keeps a custom error name": (testObject) => {
      const error = new Error("invalid input from JS");
      error.name = "ValidationError";
      expect(() => testObject.throwError(error)).to.throw(
        "ValidationError: invalid input from JS",
      );
    },

    "throwError(...) throws a conversion error for a non-Error argument": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error intentionally passing a string instead of an Error
        testObject.throwError("not an error"),
      ).to.throw(
        firstLine(
          `${testObject.constructor.name}.throwError(...): Value is a string, expected an Object`,
        ),
      );
    },

    "throwError() without an argument throws an argument count error": (
      testObject,
    ) => {
      expect(() =>
        // @ts-expect-error intentionally omitting the required argument
        testObject.throwError(),
      ).to.throw(
        exactly(
          `\`${testObject.constructor.name}.throwError(...)\` expected 1 arguments, but received 0!`,
        ),
      );
    },

    "funcThatThrows(1) throws an argument count error": (testObject) => {
      expect(() =>
        // @ts-expect-error intentionally passing an extra argument
        testObject.funcThatThrows(1),
      ).to.throw(
        exactly(
          `\`${testObject.constructor.name}.funcThatThrows(...)\` expected 0 arguments, but received 1!`,
        ),
      );
    },

    "addNumbers(...) still works after funcThatThrows() threw": (
      testObject,
    ) => {
      expect(() => testObject.funcThatThrows()).to.throw();
      expect(Object.is(testObject.addNumbers(2, 3), 5)).to.equal(true);
    },
  }),
};
