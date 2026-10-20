import { describe, expect, it } from 'react-native-harness'
import { HybridObject, NitroModules } from 'react-native-nitro-modules'
import { BenchmarkObjectCpp } from 'react-native-nitro-test'
import nitroModulesPackage from 'react-native-nitro-modules/package.json'
import {
  HybridObject as CoreHybridObject,
  NitroModules as CoreNitroModules,
} from 'nitro-core'

describe('nitro-core integration', () => {
  it('shares the installed native proxy and declared constructors with React Native', () => {
    expect(NitroModules).toBe(globalThis.NitroModulesProxy)
    expect(CoreNitroModules).toBe(NitroModules)
    expect(CoreHybridObject).toBe(HybridObject)
    expect(
      CoreNitroModules.getHybridClass<typeof BenchmarkObjectCpp>(
        'test.BenchmarkObjectCpp'
      )
    ).toBe(BenchmarkObjectCpp)
  })
})

describe('NitroModules', () => {
  it('version matches the react-native-nitro-modules JS package', () => {
    expect(NitroModules.version).toBe(nitroModulesPackage.version)
  })

  it('getAllHybridClassNames() includes every autolinked HybridObject class', () => {
    expect(NitroModules.getAllHybridClassNames()).toEqual(
      expect.arrayContaining([
        'test.BenchmarkObjectCpp',
        'test.BenchmarkObjectSwiftKotlin',
        'test.TestView',
        'test.RecyclableTestView',
      ])
    )
  })
})
