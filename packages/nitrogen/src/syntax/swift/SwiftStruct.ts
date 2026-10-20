import { createSwiftConverter, getSwiftConverter } from './SwiftConverter.js'
import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftStructType } from './types/SwiftStructType.js'
import { getImportsCode } from '../getImportCode.js'
import {
  getProtocolConformanceImports,
  getSwiftImports,
} from './getSwiftImports.js'

export function createSwiftStructBridge(
  swiftType: SwiftStructType
): SourceFile[] {
  const structType = swiftType.type
  const conformances = swiftType.getProtocolConformances()
  const protocolNames = conformances.map((conformance) => conformance.name)
  const conformancePrefix = protocolNames.length > 0 ? ': ' : ''
  const swiftProperties = structType.properties.map(
    (p) =>
      `public let ${p.escapedName}: ${p.getCode('swift', { context: 'property' })}`
  )
  const swiftInitializerParameters = structType.properties
    .map(
      (p) => `${p.escapedName}: ${p.getCode('swift', { context: 'property' })}`
    )
    .join(', ')
  const swiftPropertyInitializers = structType.properties.map(
    (p) => `self.${p.escapedName} = ${p.escapedName}`
  )
  const swiftBridgeInitializerParameters = swiftType.properties
    .map(
      (p) =>
        `_ ${p.escapedName}: ${p.getCode('swift', { context: 'property' })}`
    )
    .join(', ')
  const swiftBridgeInitializerArguments = swiftType.properties
    .map((p) => `${p.escapedName}: ${p.toSwift(p.escapedName)}`)
    .join(', ')
  const swiftBridgeGetters = swiftType.properties.map((p) => {
    const swiftGetterBody = `return ${p.fromSwift(`self.${p.escapedName}`)}`
    return `
@_spi(NitroCxx)
public borrowing func get${capitalizeName(p.escapedName)}_cxx() -> ${p.getCode('swift', { context: 'return' })} {
  ${swiftGetterBody}
}
`.trim()
  })
  const swiftImports = getImportsCode([
    ...getProtocolConformanceImports(conformances),
    ...getSwiftImports(
      [...structType.properties, ...swiftType.properties],
      'public'
    ),
    { language: 'swift', name: 'NitroModules', access: 'internal' },
    { language: 'swift', name: 'CxxStdlib', access: 'internal' },
  ])
  const swiftFile: SourceFile = {
    name: `${structType.structName}.swift`,
    language: 'swift',
    platform: 'ios',
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
  const cppInitializerArguments = swiftType.properties.map(
    (p) =>
      `JSIConverter<${p.getCode('c++', { context: 'type-argument' })}>::fromJSI(runtime, object.getProperty(runtime, PropNameIDCache::get(runtime, "${p.name}")))`
  )
  const cppPropertyConversions = swiftType.properties.map((p) => {
    const swiftGetterName = `get${capitalizeName(p.escapedName)}_cxx`
    return `object.setProperty(runtime, PropNameIDCache::get(runtime, "${p.name}"), JSIConverter<${p.getCode('c++', { context: 'type-argument' })}>::toJSI(runtime, value.${swiftGetterName}()));`
  })
  const cppPropertyChecks = swiftType.properties.map(
    (p) =>
      `JSIConverter<${p.getCode('c++', { context: 'type-argument' })}>::canConvert(runtime, object.getProperty(runtime, PropNameIDCache::get(runtime, "${p.name}")))`
  )
  const jsToSwiftConverterCode = `
auto object = value.asObject(runtime);
return ${cppStructType}::init_cxx(${cppInitializerArguments.join(', ')});
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
  const cppNativeStructType = structType.getCode('c++', {
    context: 'value',
    fullyQualified: true,
  })
  const cppInitializerValues = structType.properties.map(
    (property) =>
      `${getSwiftConverter(property)}::fromSwift(value.get${capitalizeName(property.escapedName)}_cxx())`
  )
  const swiftInitializerValues = structType.properties.map(
    (property) =>
      `${getSwiftConverter(property)}::toSwift(value.${property.escapedName})`
  )
  const swiftToCppConverterCode = `return ${cppNativeStructType}(${cppInitializerValues.join(', ')});`
  const cppToSwiftConverterCode = `return SwiftType::init_cxx(${swiftInitializerValues.join(', ')});`
  return [
    swiftFile,
    ...createSwiftConverter({
      name: swiftType.name,
      cppType: structType,
      swiftType: swiftType,
      forwardDeclaration: swiftType.forwardDeclaration,
      fromSwift: swiftToCppConverterCode,
      toSwift: cppToSwiftConverterCode,
      imports: [
        {
          language: 'c++',
          declaration: {
            name: 'NitroModules/PropNameIDCache.hpp',
            space: 'system',
          },
        },
      ],
      fromJSI: jsToSwiftConverterCode,
      toJSI: swiftToJSConverterCode,
      canConvert: jsCanConvertCode,
    }),
  ]
}
