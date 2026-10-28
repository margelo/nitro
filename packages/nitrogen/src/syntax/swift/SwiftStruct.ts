import { createSwiftConverter, getSwiftConverter, type SwiftCppConverter } from './SwiftConverter.js'
import { createSwiftJSIConverter } from './SwiftJSIConverter.js'
import { StructType } from '../types/StructType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import type { Type } from '../types/Type.js'
import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftStructType } from './types/SwiftStructType.js'
import { getImportsCode } from '../getImportCode.js'
import { getProtocolConformanceImports, getSwiftImports } from './getSwiftImports.js'
import type { CppHelper } from '../c++/CppHelper.js'
import type { SwiftNamedType } from './types/SwiftNamedType.js'

export function createSwiftStructBridge(swiftType: SwiftStructType): SourceFile[] {
  const structType = swiftType.type
  const conformances = swiftType.getProtocolConformances()
  const protocolNames = conformances.map((conformance) => conformance.name)
  const conformancePrefix = protocolNames.length > 0 ? ': ' : ''
  const swiftProperties = structType.properties.map((p) => `public let ${p.escapedName}: ${p.getCode('swift', { context: 'property' })}`)
  const swiftInitializerParameters = structType.properties
    .map((p) => `${p.escapedName}: ${p.getCode('swift', { context: 'property' })}`)
    .join(', ')
  const swiftPropertyInitializers = structType.properties.map((p) => `self.${p.escapedName} = ${p.escapedName}`)
  const swiftBridgeProperties = swiftType.properties.map((p) => {
    let propertyType: string
    let propertyValue: string
    if (p.requiresOpaqueCxxBridge) {
      propertyType = getStructPropertyWrapperName({ type: swiftType, property: p, language: 'swift' })
      propertyValue = p.toSwift(`${p.escapedName}.value`)
    } else {
      propertyType = p.getCode('swift', { context: 'property' })
      propertyValue = p.toSwift(p.escapedName)
    }
    return { name: p.escapedName, type: propertyType, value: propertyValue }
  })
  const swiftBridgeInitializerParameters = swiftBridgeProperties.map((p) => `_ ${p.name}: ${p.type}`).join(', ')
  const swiftBridgeInitializerArguments = swiftBridgeProperties.map((p) => `${p.name}: ${p.value}`).join(', ')
  const swiftBridgeGetters = swiftType.properties.map((p) => {
    const swiftToCppValue = p.fromSwift(`self.${p.escapedName}`)
    let swiftGetterReturnType: string
    let swiftGetterValue: string
    if (p.requiresOpaqueCxxBridge) {
      swiftGetterReturnType = getStructPropertyWrapperName({ type: swiftType, property: p, language: 'swift' })
      swiftGetterValue = `${swiftGetterReturnType}(${swiftToCppValue})`
    } else {
      swiftGetterReturnType = p.getCode('swift', { context: 'return' })
      swiftGetterValue = swiftToCppValue
    }
    const swiftGetterBody = `
return ${indent(swiftGetterValue, '')}
`.trim()
    return `
@_spi(NitroCxx)
public borrowing func get${capitalizeName(p.escapedName)}_cxx() -> ${swiftGetterReturnType} {
  ${indent(swiftGetterBody, '  ')}
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
  const cppInitializerArguments = swiftType.properties.map((p) => {
    const cppPropertyType = p.getCode('c++', { context: 'type-argument' })
    const jsToSwiftPropertyCode = `
JSIConverter<${cppPropertyType}>::fromJSI(runtime, object.getProperty(runtime, PropNameIDCache::get(runtime, "${p.name}")))
`.trim()
    return wrapCppStructProperty({ type: swiftType, property: p, value: jsToSwiftPropertyCode })
  })
  const cppPropertyConversions = swiftType.properties.map((p) => {
    const cppGetter = getCppStructProperty(p)
    const cppPropertyType = p.getCode('c++', { context: 'type-argument' })
    return `
object.setProperty(runtime, PropNameIDCache::get(runtime, "${p.name}"), JSIConverter<${cppPropertyType}>::toJSI(runtime, ${indent(cppGetter, '')}));
`.trim()
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
  const properties = structType.properties.map((property) => {
    const swiftProperty = type.properties.find((candidate) => candidate.name === property.name)
    if (swiftProperty == null) throw new Error(`Missing Swift property ${type.name}.${property.name}`)
    return { native: property, swift: swiftProperty }
  })
  const nativeStructType = structType.getCode('c++', { context: 'value', fullyQualified: true })
  const cppInitializerValues = properties.map(({ native, swift }) => {
    const converter = getSwiftConverter({ cppType: native, swiftType: swift })
    const cppGetter = getCppStructProperty(swift)
    return `
${converter}::fromSwift(${indent(cppGetter, '')})
`.trim()
  })
  const swiftInitializerValues = properties.map(({ native, swift }) => {
    const converter = getSwiftConverter({ cppType: native, swiftType: swift })
    const cppToSwiftPropertyCode = `
${converter}::toSwift(value.${native.escapedName})
`.trim()
    return wrapCppStructProperty({ type: type, property: swift, value: cppToSwiftPropertyCode })
  })
  const swiftToCppConverterCode = `
return ${nativeStructType}(${cppInitializerValues.join(', ')});
`.trim()
  const cppToSwiftConverterCode = `
return SwiftType::init_cxx(${swiftInitializerValues.join(', ')});
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
  })
}

interface StructPropertyWrapperOptions {
  type: SwiftStructType
  property: SwiftNamedType
  language: 'swift' | 'c++'
}

function getStructPropertyWrapperName({ type, property, language }: StructPropertyWrapperOptions): string {
  const namespace = type.config.getSwiftBridgeNamespace(language)
  const name = `${type.name}_${property.escapedName}_cxx`
  switch (language) {
    case 'swift':
      return `${namespace}.${name}`
    case 'c++':
      return `${namespace}::${name}`
  }
}

interface WrapCppStructPropertyOptions {
  type: SwiftStructType
  property: SwiftNamedType
  value: string
}

function wrapCppStructProperty({ type, property, value }: WrapCppStructPropertyOptions): string {
  if (property.requiresOpaqueCxxBridge) {
    const wrapper = getStructPropertyWrapperName({ type: type, property: property, language: 'c++' })
    return `
${wrapper}(${indent(value, '')})
`.trim()
  }
  return value
}

function getCppStructProperty(property: SwiftNamedType): string {
  const getterName = capitalizeName(property.escapedName)
  const cppGetter = `value.get${getterName}_cxx()`
  if (property.requiresOpaqueCxxBridge) {
    return `${cppGetter}.value`
  }
  return cppGetter
}

export function createSwiftStructPropertyHelpers(type: SwiftStructType): CppHelper[] {
  if (type.config.isExternalConfig) return []
  const properties = type.properties.filter((property) => property.requiresOpaqueCxxBridge)
  return properties.map((property) => {
    const name = `${type.name}_${property.escapedName}_cxx`
    const cppType = property.getCode('c++', { context: 'value' })
    // TODO: Remove these module-owned wrappers once our minimum Xcode includes
    // https://github.com/swiftlang/swift/pull/93321, fixing https://github.com/swiftlang/swift/issues/93318.
    const cppWrapperCode = `
struct ${name} final {
  ${cppType} value;
  explicit ${name}(${cppType} value) : value(std::move(value)) {}
};
`.trim()
    return {
      header: {
        code: cppWrapperCode,
        requiredImports: [
          ...property.getRequiredImports('c++', 'declaration'),
          { language: 'c++', declaration: { header: 'utility', space: 'system' } },
        ],
      },
    }
  })
}
