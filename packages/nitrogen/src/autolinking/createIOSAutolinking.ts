import type { Autolinking } from './Autolinking.js'
import type { SourceFile } from '../syntax/SourceFile.js'
import { createHybridObjectInitializer } from './ios/createHybridObjectInitializer.js'
import { createSharedCxxModuleMap } from './ios/createSharedCxxModuleMap.js'
import { createAppleCxxTarget } from './ios/createAppleCxxTarget.js'
import { createSwiftCxxBridge } from './ios/createSwiftCxxBridge.js'
import { createSwiftForeignTypeMetadata } from './ios/createSwiftForeignTypeMetadata.js'
import { createSwiftUmbrellaHeader } from './ios/createSwiftUmbrellaHeader.js'
import { NitroConfig } from '../config/NitroConfig.js'
import { createFileMetadataString } from '../syntax/helpers.js'
import { getAllKnownTypes } from '../syntax/createType.js'
import { wrapSwiftType } from '../syntax/swift/wrapSwiftType.js'
import type { HybridObjectSpec } from '../syntax/HybridObjectSpec.js'
import { getModuleDependencies } from '../syntax/getModuleDependencies.js'

interface IOSAutolinking extends Autolinking {}

export function createIOSAutolinking(
  specs: HybridObjectSpec[]
): IOSAutolinking {
  const swiftTypes = getAllKnownTypes('swift').map(wrapSwiftType)
  const moduleDependencies = getModuleDependencies(
    specs.filter((spec) => spec.language === 'swift'),
    NitroConfig.current
  )
  const swiftCxxBridge = createSwiftCxxBridge(swiftTypes)
  const swiftUmbrellaHeader = createSwiftUmbrellaHeader(
    swiftTypes,
    moduleDependencies
  )
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  const swiftForeignTypeMetadata = createSwiftForeignTypeMetadata(swiftTypes)
  const hybridObjectInitializer = createHybridObjectInitializer(specs)
  const appleCxxTarget = createAppleCxxTarget({
    moduleDependencies: moduleDependencies,
    bridgeDeclarations: swiftCxxBridge.declarations,
  })
  const swiftBridgeModuleMap: SourceFile = {
    name: 'module.modulemap',
    language: 'c++',
    platform: 'ios',
    subdirectory: ['c++', 'include'],
    content: `
${createFileMetadataString('module.modulemap')}

// Headers used by Swift belong to the AppleCxx module.
// This implementation target must not claim them through an umbrella directory.
module ${NitroConfig.current.getIosModuleName()}SwiftBridge {
  requires cplusplus
}
`.trim(),
  }

  return {
    platform: 'ios',
    sourceFiles: [
      swiftCxxBridge.implementation,
      swiftUmbrellaHeader,
      ...swiftForeignTypeMetadata,
      swiftBridgeModuleMap,
      ...hybridObjectInitializer,
      ...appleCxxTarget,
      ...createSharedCxxModuleMap(specs),
    ],
  }
}
