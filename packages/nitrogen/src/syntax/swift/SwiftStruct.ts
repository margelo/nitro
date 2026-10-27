import { createSwiftConverter, getSwiftConverter, type SwiftCppConverter } from './SwiftConverter.js'
import { createSwiftJSIConverter } from './SwiftJSIConverter.js'
import { StructType } from '../types/StructType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import type { Type } from '../types/Type.js'
import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { SwiftStructType } from './types/SwiftStructType.js'
import { getImportsCode } from '../getImportCode.js'
import { getProtocolConformanceImports, getSwiftImports } from './getSwiftImports.js'
import { SWIFT_RESULT_STORAGE } from './SwiftMethodHelpers.js'
import { createCppStructGetter, createCppStructInitializer, getSwiftStructPropertyBridges } from './SwiftStructHelpers.js'
import { SwiftCxxOutPointerType } from './types/SwiftCxxOutPointerType.js'

export function createSwiftStructBridge(swiftType: SwiftStructType): SourceFile[] {
  const structType = swiftType.type
  const properties = getSwiftStructPropertyBridges(swiftType)
  const conformances = swiftType.getProtocolConformances()
  const protocolNames = conformances.map((conformance) => conformance.name)
  const conformancePrefix = protocolNames.length > 0 ? ': ' : ''
  const swiftProperties = structType.properties.map((p) => `public let ${p.escapedName}: ${p.getCode('swift', { context: 'property' })}`)
  const swiftInitializerParameters = structType.properties
    .map((p) => `${p.escapedName}: ${p.getCode('swift', { context: 'property' })}`)
    .join(', ')
  const swiftPropertyInitializers = structType.properties.map((p) => `self.${p.escapedName} = ${p.escapedName}`)
  const swiftBridgeInitializerParameters = properties
    .map(({ property, parameterType }) => `_ ${property.escapedName}: ${parameterType.getCode('swift', { context: 'property' })}`)
    .join(', ')
  const swiftBridgeInitializerArguments = properties
    .map(({ property, parameterType }) => `${property.escapedName}: ${parameterType.toSwift(property.escapedName)}`)
    .join(', ')
  const swiftBridgeGetters = properties.map(({ property, returnType }) => {
    let swiftGetterParameters: string
    let swiftGetterReturnType: string
    let swiftGetterBody: string
    if (returnType instanceof SwiftCxxOutPointerType) {
      swiftGetterParameters = `_ ${SWIFT_RESULT_STORAGE}: ${returnType.getCode('swift', { context: 'parameter' })}`
      swiftGetterReturnType = 'Void'
      swiftGetterBody = returnType.initialize('swift', SWIFT_RESULT_STORAGE, returnType.fromSwift(`self.${property.escapedName}`))
    } else {
      swiftGetterParameters = ''
      swiftGetterReturnType = returnType.getCode('swift', { context: 'return' })
      swiftGetterBody = `return ${returnType.fromSwift(`self.${property.escapedName}`)}`
    }
    return `
@_spi(NitroCxx)
public borrowing func get${capitalizeName(property.escapedName)}_cxx(${swiftGetterParameters}) -> ${swiftGetterReturnType} {
  ${swiftGetterBody}
}
`.trim()
  })
  const swiftImports = getImportsCode([
    ...getProtocolConformanceImports(conformances),
    ...getSwiftImports([...structType.properties, ...swiftType.properties], 'public'),
    { language: 'swift', name: 'NitroModules', access: 'internal' },
    { language: 'swift', name: 'CxxStdlib', access: 'internal' },
  ])
  const swiftFile: SourceFile = {
    name: `${structType.structName}.swift`,
    language: 'swift',
    platform: 'apple',
    subdirectory: [],
    content: `
${createFileMetadataString(`${structType.structName}.swift`)}

${swiftImports}

@_expose(Cxx)
public struct ${structType.structName}${conformancePrefix}${protocolNames.join(', ')} {
  ${indent(swiftProperties.join('\n'), '  ')}

  public init(${swiftInitializerParameters}) {
    ${indent(swiftPropertyInitializers.join('\n'), '    ')}
  }

  @_spi(NitroCxx)
  public static func init_cxx(${swiftBridgeInitializerParameters}) -> Self {
    return Self(${swiftBridgeInitializerArguments})
  }

  ${indent(swiftBridgeGetters.join('\n\n'), '  ')}
}
`.trim(),
  }

  const cppStructType = swiftType.getCode('c++', { context: 'value' })
  const cppInitializerCode = createCppStructInitializer({
    type: cppStructType,
    properties: properties,
    getCppValue: (property) =>
      `JSIConverter<${property.getCode('c++', { context: 'type-argument' })}>::fromJSI(runtime, object.getProperty(runtime, PropNameIDCache::get(runtime, "${property.name}")))`,
  })
  const cppPropertyConversions = properties.map((propertyBridge) => {
    const { property } = propertyBridge
    const cppGetter = createCppStructGetter({ property: propertyBridge, receiver: 'value' })
    return `object.setProperty(runtime, PropNameIDCache::get(runtime, "${property.name}"), JSIConverter<${property.getCode('c++', { context: 'type-argument' })}>::toJSI(runtime, ${cppGetter}));`
  })
  const cppPropertyChecks = swiftType.properties.map(
    (p) =>
      `JSIConverter<${p.getCode('c++', { context: 'type-argument' })}>::canConvert(runtime, object.getProperty(runtime, PropNameIDCache::get(runtime, "${p.name}")))`
  )
  const jsToSwiftConverterCode = `
auto object = value.asObject(runtime);
${cppInitializerCode}
`.trim()
  const swiftToJSConverterCode = `
jsi::Object object(runtime);
${cppPropertyConversions.join('\n')}
return object;
`.trim()
  const jsCanConvertCode = `
if (!value.isObject()) return false;
auto object = value.getObject(runtime);
if (!isPlainObject(runtime, object)) return false;
return ${cppPropertyChecks.join(' && ')};
`.trim()
  return [
    swiftFile,
    ...createSwiftJSIConverter({
      name: swiftType.name,
      swiftType: swiftType,
      forwardDeclaration: swiftType.forwardDeclaration,
      imports: [
        {
          language: 'c++',
          declaration: {
            header: 'NitroModules/PropNameIDCache.hpp',
            space: 'system',
          },
        },
        ...getStructBridgeCppImports(swiftType),
      ],
      fromJSI: jsToSwiftConverterCode,
      toJSI: swiftToJSConverterCode,
      canConvert: jsCanConvertCode,
    }),
  ]
}

interface SwiftStructCppConverterOptions {
  type: SwiftStructType
  cppType: Type
}

export function createSwiftStructCppConverter({ type, cppType }: SwiftStructCppConverterOptions): SwiftCppConverter {
  const structType = getTypeAs(cppType, StructType)
  const propertyBridges = getSwiftStructPropertyBridges(type)
  const properties = structType.properties.map((property) => {
    const bridge = propertyBridges.find((candidate) => candidate.property.name === property.name)
    if (bridge == null) throw new Error(`Missing Swift property ${type.name}.${property.name}`)
    return { native: property, swift: bridge.property, bridge: bridge }
  })
  const nativeStructType = structType.getCode('c++', { context: 'value', fullyQualified: true })
  const cppInitializerValues = properties.map(({ native, swift, bridge }) => {
    const converter = getSwiftConverter({ cppType: native, swiftType: swift })
    const cppGetter = createCppStructGetter({ property: bridge, receiver: 'value' })
    return `${converter}::fromSwift(${cppGetter})`
  })
  const cppToSwiftConverterCode = createCppStructInitializer({
    type: 'SwiftType',
    properties: propertyBridges,
    getCppValue: (property) => {
      const native = structType.properties.find((candidate) => candidate.name === property.name)
      if (native == null) throw new Error(`Missing C++ property ${type.name}.${property.name}`)
      const converter = getSwiftConverter({ cppType: native, swiftType: property })
      return `${converter}::toSwift(value.${native.escapedName})`
    },
  })
  const swiftToCppConverterCode = `
return ${nativeStructType}(${cppInitializerValues.join(', ')});
`.trim()
  const dependencies = properties.map(({ native, swift }) => swift.getCppConverter(native))
  const name = `${type.name}+${type.moduleName}`
  return createSwiftConverter({
    name: name,
    cppType: cppType,
    swiftType: type,
    forwardDeclaration: type.forwardDeclaration,
    fromSwift: swiftToCppConverterCode,
    toSwift: cppToSwiftConverterCode,
    dependencies: dependencies,
    imports: getStructBridgeCppImports(type),
  })
}

function getStructBridgeCppImports(type: SwiftStructType): SourceImport<'c++'>[] {
  const hasOpaqueProperties = type.properties.some((property) => property.requiresOpaqueCxxBridge)
  if (hasOpaqueProperties) {
    return [
      { language: 'c++', declaration: { header: 'NitroModules/SwiftResult.hpp', space: 'system' } },
      { language: 'c++', declaration: { header: 'memory', space: 'system' } },
    ]
  }
  return []
}
