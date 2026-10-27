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
import { SwiftCxxBorrowedPointerType } from './types/SwiftCxxBorrowedPointerType.js'
import { SwiftCxxOutPointerType } from './types/SwiftCxxOutPointerType.js'
import { SwiftNamedType } from './types/SwiftNamedType.js'

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
    if (p.requiresOpaqueCxxBridge) {
      const pointerType = new SwiftCxxBorrowedPointerType(p)
      return new SwiftNamedType(p.name, pointerType)
    }
    return p
  })
  const swiftBridgeInitializerParameters = swiftBridgeProperties
    .map((p) => `_ ${p.escapedName}: ${p.getCode('swift', { context: 'property' })}`)
    .join(', ')
  const swiftBridgeInitializerArguments = swiftBridgeProperties.map((p) => `${p.escapedName}: ${p.toSwift(p.escapedName)}`).join(', ')
  const swiftBridgeGetters = swiftType.properties.map((p) => {
    const swiftGetterValue = p.fromSwift(`self.${p.escapedName}`)
    let swiftGetterParameters: string
    let swiftGetterReturnType: string
    let swiftGetterBody: string
    if (p.requiresOpaqueCxxBridge) {
      const returnType = new SwiftCxxOutPointerType(p)
      swiftGetterParameters = `_ ${SWIFT_RESULT_STORAGE}: ${returnType.getCode('swift', { context: 'parameter' })}`
      swiftGetterReturnType = 'Void'
      swiftGetterBody = returnType.initialize('swift', SWIFT_RESULT_STORAGE, swiftGetterValue)
    } else {
      swiftGetterParameters = ''
      swiftGetterReturnType = p.getCode('swift', { context: 'return' })
      swiftGetterBody = `return ${swiftGetterValue}`
    }
    return `
@_spi(NitroCxx)
public borrowing func get${capitalizeName(p.escapedName)}_cxx(${swiftGetterParameters}) -> ${swiftGetterReturnType} {
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
  const cppInitializerArguments = swiftType.properties.map((p) => ({
    property: p,
    value: `JSIConverter<${p.getCode('c++', { context: 'type-argument' })}>::fromJSI(runtime, object.getProperty(runtime, PropNameIDCache::get(runtime, "${p.name}")))`,
  }))
  const cppInitializerCode = createCppStructInitializer({ type: cppStructType, properties: cppInitializerArguments })
  const cppPropertyConversions = swiftType.properties.map((p) => {
    const cppGetter = createCppStructGetter({ property: p, receiver: 'value' })
    return `object.setProperty(runtime, PropNameIDCache::get(runtime, "${p.name}"), JSIConverter<${p.getCode('c++', { context: 'type-argument' })}>::toJSI(runtime, ${cppGetter}));`
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
  const properties = structType.properties.map((property) => {
    const swiftProperty = type.properties.find((candidate) => candidate.name === property.name)
    if (swiftProperty == null) throw new Error(`Missing Swift property ${type.name}.${property.name}`)
    return { native: property, swift: swiftProperty }
  })
  const nativeStructType = structType.getCode('c++', { context: 'value', fullyQualified: true })
  const cppInitializerValues = properties.map(({ native, swift }) => {
    const converter = getSwiftConverter({ cppType: native, swiftType: swift })
    const cppGetter = createCppStructGetter({ property: swift, receiver: 'value' })
    return `${converter}::fromSwift(${cppGetter})`
  })
  const swiftInitializerValues = properties.map(({ native, swift }) => {
    const converter = getSwiftConverter({ cppType: native, swiftType: swift })
    return { property: swift, value: `${converter}::toSwift(value.${native.escapedName})` }
  })
  const swiftToCppConverterCode = `
return ${nativeStructType}(${cppInitializerValues.join(', ')});
`.trim()
  const cppToSwiftConverterCode = createCppStructInitializer({ type: 'SwiftType', properties: swiftInitializerValues })
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

interface CppStructInitializerOptions {
  type: string
  properties: { property: SwiftNamedType; value: string }[]
}

/** Keeps borrowed C++ values alive until Swift has copied them into the struct. */
function createCppStructInitializer({ type, properties }: CppStructInitializerOptions): string {
  const cppInitializers: string[] = []
  const cppArguments = properties.map(({ property, value }) => {
    if (property.requiresOpaqueCxxBridge) {
      const name = `__${property.escapedName}`
      cppInitializers.push(`auto ${name} = ${value};`)
      return `std::addressof(${name})`
    }
    return value
  })
  const cppInitializerCode = `
return ${type}::init_cxx(${cppArguments.join(', ')});
`.trim()
  return [...cppInitializers, cppInitializerCode].join('\n')
}

interface CppStructGetterOptions {
  property: SwiftNamedType
  receiver: string
}

function createCppStructGetter({ property, receiver }: CppStructGetterOptions): string {
  const getterName = capitalizeName(property.escapedName)
  if (property.requiresOpaqueCxxBridge) {
    const returnType = new SwiftCxxOutPointerType(property)
    const cppInitializeCode = `
${receiver}.get${getterName}_cxx(${SWIFT_RESULT_STORAGE});
`.trim()
    return returnType.allocate('c++', {
      storage: SWIFT_RESULT_STORAGE,
      body: () => cppInitializeCode,
    })
  }
  return `${receiver}.get${getterName}_cxx()`
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
