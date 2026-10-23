import type { Autolinking } from './Autolinking.js'
import type { SourceFile } from '../syntax/SourceFile.js'
import { createHybridObjectInitializer } from './apple/createHybridObjectInitializer.js'
import { createAppleCxxTarget } from './apple/createAppleCxxTarget.js'
import { createSwiftCxxBridge } from './apple/createSwiftCxxBridge.js'
import { createSwiftForeignTypeMetadata } from './apple/createSwiftForeignTypeMetadata.js'
import { createSwiftUmbrellaHeader } from './apple/createSwiftUmbrellaHeader.js'
import { NitroConfig } from '../config/NitroConfig.js'
import { createFileMetadataString } from '../syntax/helpers.js'
import { wrapSwiftType } from '../syntax/swift/wrapSwiftType.js'
import type { HybridObjectSpec } from '../syntax/HybridObjectSpec.js'
import { getModuleDependencies } from '../syntax/getModuleDependencies.js'
import { getAllReferencedTypes } from '../syntax/getAllTypes.js'
import { HybridObjectType } from '../syntax/types/HybridObjectType.js'
import { prepareSwiftMethod } from '../syntax/swift/SwiftMethodHelpers.js'
import type { SwiftType } from '../syntax/swift/types/SwiftType.js'
import { ForeignHybridObjectType } from '../syntax/c++/ForeignHybridObjectType.js'
import { StaticMethod } from '../syntax/StaticMethod.js'

interface AppleAutolinking extends Autolinking {}

/** Swift bridge dependencies come from the APIs emitted in this module. */
function getSwiftTypes(specs: HybridObjectSpec[]): SwiftType[] {
  return specs.flatMap((spec) => {
    if (spec.language !== 'swift') return []

    const baseTypes = getSwiftTypes(spec.baseTypes)
    const hybridObject = new HybridObjectType(spec)
    const referencedTypes = getAllReferencedTypes(spec)
    const swiftTypes = referencedTypes.map((type) => wrapSwiftType(type, spec.config))
    const methods = [...spec.methods, ...spec.staticMethods]
    if (spec.constructor != null) methods.push(spec.constructor.toStaticMethod(hybridObject))
    if (spec.isHybridView) methods.push(new StaticMethod(`create${spec.name}View`, hybridObject, []))
    const resultTypes = methods.map((method) => prepareSwiftMethod(method, true, spec.config).resultType)
    return [...baseTypes, wrapSwiftType(hybridObject, spec.config), ...swiftTypes, ...resultTypes]
  })
}

export function createAppleAutolinking(specs: HybridObjectSpec[]): AppleAutolinking {
  const foreignSwiftTypes = specs
    .flatMap(getAllReferencedTypes)
    .flatMap((type) => (type instanceof ForeignHybridObjectType ? type.getSwiftTypes() : []))
  const swiftTypes = [...getSwiftTypes(specs), ...foreignSwiftTypes]
  const moduleDependencies = getModuleDependencies(specs, NitroConfig.current)
  const swiftCxxBridge = createSwiftCxxBridge(swiftTypes)
  const swiftUmbrellaHeader = createSwiftUmbrellaHeader(swiftTypes, moduleDependencies)
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
    ],
  }
}
