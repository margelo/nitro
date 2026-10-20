import { describe, expect, it } from 'react-native-harness'
import {
  getHybridObjectConstructor,
  NitroModules,
} from 'react-native-nitro-modules'
import nitroModulesPackage from 'react-native-nitro-modules/package.json'
import {
  getHybridObjectConstructor as getCoreHybridObjectConstructor,
  getInstalledNitro,
  NitroModules as CoreNitroModules,
} from 'nitro-core'

describe('nitro-core integration', () => {
  it('shares the installed native proxy and constructor helper with React Native', () => {
    expect(NitroModules).toBe(getInstalledNitro())
    expect(CoreNitroModules).toBe(NitroModules)
    expect(getCoreHybridObjectConstructor).toBe(getHybridObjectConstructor)
  })
})

describe('NitroModules', () => {
  it('version matches the react-native-nitro-modules JS package', () => {
    expect(NitroModules.version).toBe(nitroModulesPackage.version)
  })

  it('getAllHybridObjectNames() includes every autolinked HybridObject', () => {
    expect(NitroModules.getAllHybridObjectNames()).toEqual(
      expect.arrayContaining([
        'BenchmarkObjectCpp',
        'BenchmarkObjectSwiftKotlin',
        'TestView',
        'RecyclableTestView',
      ])
    )
  })
})
