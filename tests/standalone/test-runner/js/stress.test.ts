import { expect } from "chai";
import { casesForTestObjects } from "./utils/cases";

import { getNitroModules } from "nitro-core";

const NitroModules = getNitroModules();

export const cases = {
  ...casesForTestObjects("Promises under parallel load", {
    // Resolve HybridObjects off the JS thread while JSIConverter::toJSI reads
    // Promise state on the JS thread.

    "newTestObjectAsync() resolves HybridObjects under parallel load":
      async (testObject) => {
        let objects: object[] = [];
        for (let round = 0; round < 20; round++) {
          objects = await Promise.all(
            Array.from({ length: 32 }, () => testObject.newTestObjectAsync()),
          );
        }
        // Only check the last round, so the stress loop itself stays cheap.
        expect(objects).to.have.length(32);
        for (const object of objects) {
          expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(
            true,
          );
        }
      },
  }),
};
