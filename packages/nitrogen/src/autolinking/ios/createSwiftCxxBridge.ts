import { NitroConfig } from '../../config/NitroConfig.js'
import {
  includeHeader,
  includeModuleHeader,
  sortSourceImports,
} from '../../syntax/c++/includeNitroHeader.js'
import { getAllKnownTypes } from '../../syntax/createType.js'
import {
  createFileMetadataString,
  isNotDuplicate,
} from '../../syntax/helpers.js'
import type { SourceFile } from '../../syntax/SourceFile.js'
import { getReferencedTypes } from '../../syntax/getReferencedTypes.js'
import { SwiftCxxBridgedType } from '../../syntax/swift/SwiftCxxBridgedType.js'
import { filterDuplicateHelperBridges, indent } from '../../utils.js'
import { getTypeAs } from '../../syntax/types/getTypeAs.js'
import { HybridObjectType } from '../../syntax/types/HybridObjectType.js'
import { getForwardDeclaration } from '../../syntax/c++/getForwardDeclaration.js'
import { getHybridObjectName } from '../../syntax/getHybridObjectName.js'

export function createSwiftCxxBridge(): SourceFile[] {
  const moduleName = NitroConfig.current.getIosModuleName()
  const bridgeName = NitroConfig.current.getSwiftBridgeHeaderName()
  const bridgeNamespace = NitroConfig.current.getSwiftBridgeNamespace('c++')

  const types = getAllKnownTypes('swift').map((t) => new SwiftCxxBridgedType(t))

  const bridges = types
    .flatMap((t) => {
      const referenced = getReferencedTypes(t.type)
      return referenced.map((r) => {
        const bridge = new SwiftCxxBridgedType(r)
        return bridge.getRequiredBridge()
      })
    })
    .filter((b) => b != null)
    .flatMap((b) => [b, ...b?.dependencies])
    .filter(filterDuplicateHelperBridges)
  const headerHelperFunctions = bridges
    .map((b) => `// pragma MARK: ${b.cxxType}\n${b.cxxHeader.code}`)
    .filter(isNotDuplicate)
    .join('\n\n')
  const implementationHelperFunctions = bridges
    .map((b) => {
      if (b.cxxImplementation == null) return undefined
      else return `// pragma MARK: ${b.cxxType}\n${b.cxxImplementation.code}`
    })
    .filter((c) => c != null)
    .filter(isNotDuplicate)
    .join('\n\n')

  const requiredImportsHeader = bridges.flatMap(
    (b) => b.cxxHeader.requiredIncludes
  )
  const includesHeader = sortSourceImports(requiredImportsHeader)
    .map((i) => includeModuleHeader(i, moduleName, true))
    .filter(isNotDuplicate)
  const forwardDeclarationsHeader = requiredImportsHeader
    .map((i) => i.forwardDeclaration)
    .filter((f) => f != null)
    .filter(isNotDuplicate)

  const includesImplementation = bridges
    .flatMap((b) => b.cxxImplementation?.requiredIncludes)
    .filter((i) => i != null)
    .map((i) => includeHeader(i, true))
    .filter(isNotDuplicate)

  const forwardDeclaredSwiftTypes = types
    .filter((t) => t.type.kind === 'hybrid-object')
    .map((t) => {
      const hybridObject = getTypeAs(t.type, HybridObjectType)
      const hybridObjectModuleName =
        hybridObject.sourceConfig.getIosModuleName()
      const { HybridTSpecCxx } = getHybridObjectName(
        hybridObject.hybridObjectName
      )
      return getForwardDeclaration(
        'class',
        HybridTSpecCxx,
        hybridObjectModuleName
      )
    })
    .filter(isNotDuplicate)

  const header = `
${createFileMetadataString(`${bridgeName}.hpp`)}

#pragma once

// Forward declarations of C++ defined types
${forwardDeclarationsHeader.sort().join('\n')}

// Forward declarations of Swift defined types
${forwardDeclaredSwiftTypes.sort().join('\n')}

// Include C++ defined types
${includesHeader.join('\n')}

/**
 * Contains specialized versions of C++ templated types so they can be accessed from Swift,
 * as well as helper functions to interact with those C++ types from Swift.
 */
namespace ${bridgeNamespace} {

  ${indent(headerHelperFunctions, '  ')}

} // namespace ${bridgeNamespace}
`

  const source = `
${createFileMetadataString(`${bridgeName}.cpp`)}

#include "${bridgeName}.hpp"

// Include C++ implementation defined types
${includesImplementation.sort().join('\n')}

namespace ${bridgeNamespace} {

  ${indent(implementationHelperFunctions, '  ')}

} // namespace ${bridgeNamespace}
`

  const files: SourceFile[] = []
  files.push({
    content: header,
    language: 'c++',
    name: `${bridgeName}.hpp`,
    platform: 'ios',
    subdirectory: [],
  })
  files.push({
    content: source,
    language: 'c++',
    name: `${bridgeName}.cpp`,
    platform: 'ios',
    subdirectory: [],
  })
  return files
}
