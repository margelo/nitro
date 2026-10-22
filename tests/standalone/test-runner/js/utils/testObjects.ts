import { NitroModules } from 'nitro-core'
import { Base as ExternalBase } from 'nitro-test-external'
import { TestObjectSwiftKotlin, type TestObjectCpp } from 'nitro-test'

export type TestObject = TestObjectCpp | TestObjectSwiftKotlin

declare global {
  var __nitroTestPlatform: 'ios' | 'android'
  function gc(): void
}

export const HybridChild = new TestObjectSwiftKotlin().createChild()
export const HybridSomeExternalObject = new ExternalBase().createExternalObject()

export function isSwift(testObject: TestObject): boolean {
  return testObject.constructor.name === 'TestObjectSwiftKotlin' && globalThis.__nitroTestPlatform === 'ios'
}

export function isKotlin(testObject: TestObject): boolean {
  return testObject.constructor.name === 'TestObjectSwiftKotlin' && globalThis.__nitroTestPlatform === 'android'
}
