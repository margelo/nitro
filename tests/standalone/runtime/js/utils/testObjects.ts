import { getNitroModules } from "nitro-core";
import type { SomeExternalObject } from "../../../external/specs/SomeExternalObject.nitro";
import type { Child } from "../../specs/Child.nitro";
import type {
  TestObjectCpp,
  TestObjectSwiftKotlin,
} from "../../specs/TestObject.nitro";

export type TestObject = TestObjectCpp | TestObjectSwiftKotlin;

declare global {
  var __nitroTestPlatform: "ios" | "android";
  function gc(): void;
}

export const HybridChild = getNitroModules().createHybridObject<Child>("Child");
export const HybridSomeExternalObject =
  getNitroModules().createHybridObject<SomeExternalObject>(
    "SomeExternalObject",
  );

export function isSwift(testObject: TestObject): boolean {
  return (
    testObject.name === "TestObjectSwiftKotlin" &&
    globalThis.__nitroTestPlatform === "ios"
  );
}

export function isKotlin(testObject: TestObject): boolean {
  return (
    testObject.name === "TestObjectSwiftKotlin" &&
    globalThis.__nitroTestPlatform === "android"
  );
}
