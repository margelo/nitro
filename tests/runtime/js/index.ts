import { config } from "chai";

config.includeStack = true;
config.truncateThreshold = 0;

declare global {
  var runNitroTest: (name: string) => Promise<void>;
}

export function registerTests(
  cases: Record<string, () => void | Promise<void>>,
): void {
  // Native runners report each discovered case independently. Async tests stay
  // alive until their returned Promise settles, including native callbacks.
  globalThis.runNitroTest = async (name: string) => {
    const test = Object.hasOwn(cases, name) ? cases[name] : undefined;
    if (typeof test !== "function")
      throw new Error(`Unknown Nitro test: ${name}`);
    await test();
  };
}
