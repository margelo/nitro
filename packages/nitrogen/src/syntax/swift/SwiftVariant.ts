import { createSwiftConverter, getSwiftConverter, type SwiftCppConverter } from './SwiftConverter.js'
import { createSwiftJSIConverter } from './SwiftJSIConverter.js'
import { VariantType } from '../types/VariantType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import type { Type } from '../types/Type.js'
import { wrapSwiftType } from './wrapSwiftType.js'
import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftVariantType } from './types/SwiftVariantType.js'
import { getImportsCode } from '../getImportCode.js'
import { getProtocolConformanceImports, getSwiftImports } from './getSwiftImports.js'
import { SwiftOutPointerType } from './types/SwiftOutPointerType.js'

export function createSwiftVariant(type: SwiftVariantType): SourceFile[] {
  const variantType = type.type
  const swiftEnumName = variantType.getAliasName('swift')
  const conformances = type.getProtocolConformances()
  const protocolNames = conformances.map((conformance) => conformance.name)
  const conformancePrefix = protocolNames.length > 0 ? ': ' : ''
  const imports = getSwiftImports(variantType.variants, 'public')
  const enumCases = variantType.cases
    .map(([label, v]) => {
      const swiftCaseType = v.getCode('swift', { context: 'property' })
      return `case ${label}(${swiftCaseType})`
    })
    .join('\n')
  const asTypeCases = variantType.cases
    .map(([label]) => {
      return `case .${label}(let value): return value as? T`
    })
    .join('\n')

  const indexCases = variantType.cases.map(([label], index) => `case .${label}: return ${index}`)
  // C++ initializes the variant in Swift storage.
  const storage = new SwiftOutPointerType(type)
  const payloads = variantType.cases.map(([label, inner]) => ({
    label: label,
    name: capitalizeName(label),
    type: inner,
    swiftType: wrapSwiftType(inner, type.config),
  }))
  const accessors = payloads.map(({ label, name, swiftType }) => {
    imports.push(...getSwiftImports([swiftType], 'public'))
    const payloadType = swiftType.getCode('swift', { context: 'property' })
    const storageType = storage.getCode('swift', { context: 'parameter' })
    const initializeCode = storage.initialize('swift', 'result', `Self(.${label}(${swiftType.toSwift('payload')}))`)
    return `
@_spi(NitroCxx)
public static func initialize${name}(_ payload: ${payloadType}, result: ${storageType}) {
  ${initializeCode}
}

@_spi(NitroCxx)
public borrowing func get${name}() -> ${swiftType.getCode('swift', { context: 'return' })} {
  guard case .${label}(let payload) = value else { preconditionFailure("Invalid variant case") }
  return ${swiftType.fromSwift('payload')}
}
`.trim()
  })
  const jsSignature = variantType.variants.map((t) => t.kind).join(' | ')

  const swiftImports = getImportsCode([
    ...getProtocolConformanceImports(conformances),
    ...imports,
    { language: 'swift', name: 'NitroModules', access: 'internal' },
  ])

  const swiftCode = `
${createFileMetadataString(`${swiftEnumName}.swift`)}

${swiftImports}

/**
 * A Swift enum with associated values representing a Variant/Union type.
 * JS type: \`${jsSignature}\`
 */
@frozen
public enum ${swiftEnumName}${conformancePrefix}${protocolNames.join(', ')} {
  ${indent(enumCases, '  ')}
}

public extension ${swiftEnumName} {
  func asType<T>(_ type: T.Type = T.self) -> T? {
    switch self {
      ${indent(asTypeCases, '      ')}
    }
  }
  func isType<T>(_ type: T.Type = T.self) -> Bool {
    return self.asType(type) != nil
  }
}

// Raw Swift storage keeps associated values containing imported C++ types exportable.
@_expose(Cxx)
public struct ${swiftEnumName}_cxx${conformancePrefix}${protocolNames.join(', ')} {
  let value: ${swiftEnumName}

  init(_ value: ${swiftEnumName}) {
    self.value = value
  }

  public var index: Int {
    switch value {
      ${indent(indexCases.join('\n'), '      ')}
    }
  }

  ${indent(accessors.join('\n\n'), '  ')}
}
`.trim()

  const swiftFile: SourceFile = {
    content: swiftCode,
    language: 'swift',
    name: `${swiftEnumName}.swift`,
    platform: 'apple',
    subdirectory: [],
  }

  const cppSwiftVariantType = type.getCode('c++', { context: 'value' })
  const jsToSwiftCases = payloads.map(({ name, swiftType }) => {
    const payloadType = swiftType.getCode('c++', { context: 'type-argument' })
    const result = storage.allocate('c++', {
      storage: 'result',
      body: (pointer) => `${cppSwiftVariantType}::initialize${name}(payload, ${pointer});`,
    })
    return `
if (JSIConverter<${payloadType}>::canConvert(runtime, value)) {
  auto payload = JSIConverter<${payloadType}>::fromJSI(runtime, value);
  return ${indent(result, '  ')};
}
`.trim()
  })
  const diagnosticTypes = variantType.variants
    .map((variant) => variant.getCode('c++', { context: 'type-argument', fullyQualified: true }))
    .join(', ')
  const jsToSwiftConverterCode = `
${jsToSwiftCases.join('\n')}
throw std::runtime_error("Cannot convert \\"" + value.toString(runtime).utf8(runtime) + "\\" to any type in variant<${diagnosticTypes}>!");
`.trim()
  const cppPayloads = payloads.map(({ name, swiftType }) => ({
    name: name,
    cppType: swiftType.getCode('c++', { context: 'type-argument' }),
  }))
  const swiftToJSICases = cppPayloads.map(({ name, cppType }, index) => {
    return `
case ${index}: return JSIConverter<${cppType}>::toJSI(runtime, value.get${name}());
`.trim()
  })
  const swiftToJSConverterCode = `
switch (value.getIndex()) {
  ${indent(swiftToJSICases.join('\n'), '  ')}
  default: throw std::invalid_argument("Invalid variant index");
}
`.trim()
  const jsCanConvertExpressions = cppPayloads.map(({ cppType }) => `JSIConverter<${cppType}>::canConvert(runtime, value)`)
  const jsCanConvertCode = `
return ${jsCanConvertExpressions.join(' || ')};
`.trim()
  return [
    swiftFile,
    ...createSwiftJSIConverter({
      name: type.name,
      swiftType: type,
      forwardDeclaration: type.forwardDeclaration,
      fromJSI: jsToSwiftConverterCode,
      toJSI: swiftToJSConverterCode,
      canConvert: jsCanConvertCode,
    }),
  ]
}

interface SwiftVariantCppConverterOptions {
  type: SwiftVariantType
  cppType: Type
}

export function createSwiftVariantCppConverter({ type, cppType }: SwiftVariantCppConverterOptions): SwiftCppConverter {
  const variantType = getTypeAs(cppType, VariantType)
  const cppVariantType = variantType.getCode('c++', { context: 'value', fullyQualified: true })
  const storage = new SwiftOutPointerType(type)
  const payloads = variantType.cases.map(([label, native], index) => {
    const swift = type.variants[index]
    if (swift == null) throw new Error(`Missing Swift variant case ${type.name}.${label}`)
    return { name: capitalizeName(label), native: native, swift: swift }
  })
  const swiftToCppCases = payloads.map(({ name, native, swift }, index) => {
    const converter = getSwiftConverter({ cppType: native, swiftType: swift })
    return `
case ${index}: {
  auto payload = value.get${name}();
  return ${cppVariantType}(std::in_place_index<${index}>, ${converter}::fromSwift(payload));
}
`.trim()
  })
  const cppToSwiftCases = payloads.map(({ name, native, swift }, index) => {
    const converter = getSwiftConverter({ cppType: native, swiftType: swift })
    const swiftValue = storage.allocate('c++', {
      storage: 'result',
      body: (pointer) => `SwiftType::initialize${name}(payload, ${pointer});`,
    })
    return `
case ${index}: {
  auto payload = ${converter}::toSwift(std::get<${index}>(value));
  return ${indent(swiftValue, '  ')};
}
`.trim()
  })
  const swiftToCppConverterCode = `
switch (value.getIndex()) {
  ${indent(swiftToCppCases.join('\n'), '  ')}
  default: throw std::invalid_argument("Invalid variant index");
}
`.trim()
  const cppToSwiftConverterCode = `
switch (value.index()) {
  ${indent(cppToSwiftCases.join('\n'), '  ')}
  default: throw std::bad_variant_access();
}
`.trim()
  const dependencies = payloads.flatMap(({ native, swift }) => {
    const converter = swift.getCppConverter?.(native)
    return converter == null ? [] : [converter]
  })
  return createSwiftConverter({
    name: `${type.name}+${type.moduleName}`,
    cppType: cppType,
    swiftType: type,
    forwardDeclaration: type.forwardDeclaration,
    fromSwift: swiftToCppConverterCode,
    toSwift: cppToSwiftConverterCode,
    dependencies: dependencies,
  })
}
