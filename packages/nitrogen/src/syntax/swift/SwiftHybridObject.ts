import { createSwiftHybridViewManager } from '../../views/swift/SwiftHybridViewManager.js'
import { wrapSwiftType } from './wrapSwiftType.js'
import { indent } from '../../utils.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { createFileMetadataString } from '../helpers.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { SourceFile } from '../SourceFile.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { StaticMethod } from '../StaticMethod.js'
import { createSwiftHybridObjectCxxBridge } from './SwiftHybridObjectBridge.js'
import { getImportsCode } from '../getImportCode.js'
import { getAllTypes } from '../getAllTypes.js'
import { getProtocolConformanceImports } from './getSwiftImports.js'
import { SwiftHybridObjectType } from './types/SwiftHybridObjectType.js'
import { withDocumentation } from '../Documentation.js'

export function createSwiftHybridObject(spec: HybridObjectSpec<'swift'>): SourceFile[] {
  const hybridObjectType = new HybridObjectType(spec)
  const swiftType = new SwiftHybridObjectType(hybridObjectType)
  const conformances = swiftType.getProtocolConformances()
  const name = getHybridObjectName(spec.name)
  const protocolName = name.HybridTSpec
  // Existential calls would otherwise warn inside the generated bridge.
  const emitInstanceDeprecation = !spec.allowMultipleImplementations
  const constructor = withDocumentation({
    code: spec.constructor?.getDeclaration('swift') ?? '',
    documentation: spec.constructor?.documentation,
    language: 'swift',
  })
  const properties = spec.properties
    .map((property) =>
      withDocumentation({
        code: property.getCode('swift'),
        documentation: property.documentation,
        language: 'swift',
        emitDeprecation: emitInstanceDeprecation,
      })
    )
    .join('\n')
  const methods = spec.methods
    .map((method) =>
      withDocumentation({
        code: method.getDeclaration('swift'),
        documentation: method.documentation,
        language: 'swift',
        emitDeprecation: emitInstanceDeprecation,
      })
    )
    .join('\n')
  const staticProperties = spec.staticProperties
    .map((property) =>
      withDocumentation({
        code: property.getCode('swift'),
        documentation: property.documentation,
        language: 'swift',
      })
    )
    .join('\n')
  const staticMethods = spec.staticMethods
    .map((method) => {
      const requirement = new StaticMethod(method.name, method.returnType, method.parameters, {
        ...method.options,
        documentation: method.documentation,
        protocolRequirement: true,
      })
      return withDocumentation({
        code: requirement.getDeclaration('swift'),
        documentation: requirement.documentation,
        language: 'swift',
      })
    })
    .join('\n')
  let instanceConstructor: string
  let instanceStaticProperties: string
  let instanceStaticMethods: string
  let classProtocolCode: string
  if (spec.allowMultipleImplementations) {
    instanceConstructor = ''
    instanceStaticProperties = ''
    instanceStaticMethods = ''
    const hasClassRequirements = spec.constructor != null || spec.staticProperties.length > 0 || spec.staticMethods.length > 0
    if (hasClassRequirements) {
      const implementation = spec.implementation
      if (implementation == null) {
        throw new Error(`${spec.name}: Swift constructor and static requirements need an implementation class.`)
      }
      classProtocolCode = `
/// Constructor and static requirements for the implementation selected by JavaScript.
internal protocol ${protocolName}_class {
  // Constructor
  ${indent(constructor, '  ')}

  // Static Properties
  ${indent(staticProperties, '  ')}

  // Static Methods
  ${indent(staticMethods, '  ')}
}

extension ${implementation.className}: ${protocolName}_class { }
`.trim()
    } else {
      classProtocolCode = ''
    }
  } else {
    instanceConstructor = constructor
    instanceStaticProperties = staticProperties
    instanceStaticMethods = staticMethods
    classProtocolCode = ''
  }
  const extraImports = [
    ...spec.properties.flatMap((p) => p.getRequiredImports('swift')),
    ...spec.staticProperties.flatMap((p) => p.getRequiredImports('swift')),
    ...spec.methods.flatMap((m) => m.getRequiredImports('swift')),
    ...spec.staticMethods.flatMap((method) => method.getRequiredImports('swift')),
    ...(spec.constructor?.getRequiredImports('swift') ?? []),
    ...hybridObjectType.baseTypes.flatMap((b) => b.getRequiredImports('swift')),
  ]

  const protocolBaseClasses = [`${protocolName}_base`, ...conformances.map((conformance) => conformance.name)]
  if (spec.isHybridView) {
    protocolBaseClasses.push('HybridView')
  }
  const classBaseClasses: string[] = []
  if (spec.baseTypes.length > 0) {
    if (spec.baseTypes.length > 1) {
      throw new Error(`${name.T}: Inheriting from multiple HybridObject bases is not yet supported in Swift!`)
    }
    const base = spec.baseTypes[0]
    if (base == null) {
      throw new Error(`${name.T}: Expected a Swift HybridObject base.`)
    }
    const baseName = getHybridObjectName(base.name)
    classBaseClasses.push(`${baseName.HybridTSpec}_base`)
  }
  const conformanceImports = getProtocolConformanceImports(conformances)
  const hasBaseClass = classBaseClasses.length > 0
  let wrapperAccessorModifiers = spec.allowInheritance ? 'open' : 'public final'
  if (hasBaseClass) {
    wrapperAccessorModifiers += ' override'
  }
  const baseMembers: string[] = []
  baseMembers.push(`private weak var cxxWrapper: ${name.HybridTSpecCxx}? = nil`)
  if (hasBaseClass) {
    baseMembers.push(
      `
public override init() throws {
  try super.init()
}
`.trim()
    )
  } else {
    baseMembers.push(
      `
public init() throws {
}
`.trim()
    )
  }
  baseMembers.push(
    `
${wrapperAccessorModifiers} func getCxxWrapper() -> ${name.HybridTSpecCxx} {
#if DEBUG
  guard self is any ${name.HybridTSpec} else {
    fatalError("\`self\` is not a \`${name.HybridTSpec}\`! Did you accidentally inherit from \`${name.HybridTSpec}_base\` instead of \`${name.HybridTSpec}\`?")
  }
#endif
  if let cxxWrapper = self.cxxWrapper {
    return cxxWrapper
  } else {
    let cxxWrapper = ${name.HybridTSpecCxx}(self as! any ${name.HybridTSpec})
    self.cxxWrapper = cxxWrapper
    return cxxWrapper
  }
}
`.trim()
  )

  const imports = getImportsCode([{ language: 'swift', name: 'NitroModules', access: 'public' }, ...extraImports, ...conformanceImports])

  const protocolDeclaration = withDocumentation({
    code: `
public protocol ${protocolName}_protocol: ${protocolBaseClasses.join(', ')}
`.trim(),
    documentation: spec.documentation,
    language: 'swift',
    emitDeprecation: false,
  })
  const protocolCode = `
${createFileMetadataString(`${protocolName}.swift`)}

${imports}

/// See \`\`${protocolName}\`\`
${protocolDeclaration} {
  // Constructor
  ${indent(instanceConstructor, '  ')}

  // Properties
  ${indent(properties, '  ')}

  // Methods
  ${indent(methods, '  ')}

  // Static Properties
  ${indent(instanceStaticProperties, '  ')}

  // Static Methods
  ${indent(instanceStaticMethods, '  ')}
}

public extension ${protocolName}_protocol {
  /// Default implementation of \`\`HybridObject.toString\`\`
  func toString() -> String {
    return "[HybridObject ${name.T}]"
  }
}

/// See \`\`${protocolName}\`\`
open class ${protocolName}_base${classBaseClasses.length > 0 ? `: ${classBaseClasses.join(',')}` : ''} {
  ${indent(baseMembers.join('\n'), '  ')}
}

/**
 * A Swift base-protocol representing the ${spec.name} HybridObject.
 * Implement this protocol to create Swift-based instances of ${spec.name}.
 * \`\`\`swift
 * class ${name.HybridT} : ${protocolName} {
 *   // ...
 * }
 * \`\`\`
 */
public typealias ${protocolName} = ${protocolName}_protocol & ${protocolName}_base

${classProtocolCode}
`.trim()

  const swiftBridge = createSwiftHybridObjectCxxBridge(spec)

  const files: SourceFile[] = []
  files.push({
    content: protocolCode,
    language: 'swift',
    name: `${protocolName}.swift`,
    subdirectory: [],
    platform: 'ios',
  })
  files.push(...swiftBridge)
  if (spec.isHybridView) {
    files.push(...createSwiftHybridViewManager(spec))
  }
  const types = [...getAllTypes(spec), hybridObjectType]
  const swiftTypes = types.map((type) => wrapSwiftType(type, spec.config))
  files.push(...swiftTypes.flatMap((type) => type.getExtraFiles()))

  return files
}
