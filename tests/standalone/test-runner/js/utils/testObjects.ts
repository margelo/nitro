import { NitroModules } from "nitro-core";
import { SomeExternalObject } from "nitro-test-external";
import { Child } from "nitro-test";
import type { TestObjectCpp, TestObjectSwiftKotlin } from "nitro-test";

export type TestObject = TestObjectCpp | TestObjectSwiftKotlin;

declare global {
  var __nitroTestPlatform: "ios" | "android";
  function gc(): void;
}

export const HybridChild = new Child();
export const HybridSomeExternalObject = new SomeExternalObject();

export function isSwift(testObject: TestObject): boolean {
  return (
    testObject.constructor.name === "TestObjectSwiftKotlin" &&
    globalThis.__nitroTestPlatform === "ios"
  );
}

export function isKotlin(testObject: TestObject): boolean {
  return (
    testObject.constructor.name === "TestObjectSwiftKotlin" &&
    globalThis.__nitroTestPlatform === "android"
  );
}
