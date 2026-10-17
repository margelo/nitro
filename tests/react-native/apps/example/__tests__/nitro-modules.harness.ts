import { Platform } from 'react-native'
import { describe, expect, it } from 'react-native-harness'
import {
  getHybridObjectConstructor,
  NitroModules,
} from 'react-native-nitro-modules'
import nitroModulesPackage from 'react-native-nitro-modules/package.json'
import { HybridPlatformObject } from 'react-native-nitro-test'
import {
  getHybridObjectConstructor as getCoreHybridObjectConstructor,
  getInstalledNitro,
  NitroModules as CoreNitroModules,
} from 'nitro-core'

/**
 * The OS version as React Native reports it, which reads the same platform
 * API as `PlatformObject` (`UIDevice.systemVersion` / `Build.VERSION.RELEASE`).
 */
function getReactNativeOSVersion(): string | undefined {
  switch (Platform.OS) {
    case 'ios':
      return Platform.constants.osVersion
    case 'android':
      return Platform.constants.Release
    default:
      return undefined
  }
}

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
        'TestObjectCpp',
        'TestObjectSwiftKotlin',
        'Base',
        'Child',
        'PlatformObject',
        'TestView',
        'RecyclableTestView',
        'SomeExternalObject',
      ])
    )
  })
})

describe('PlatformObject', () => {
  it('getOSVersion() matches the OS version reported by React Native', () => {
    expect(HybridPlatformObject.getOSVersion()).toBe(getReactNativeOSVersion())
  })
})
