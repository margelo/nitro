import { createSwiftConverter, type SwiftCppConverter } from './SwiftConverter.js'
import { createSwiftJSIConverter } from './SwiftJSIConverter.js'
import { EnumType } from '../types/EnumType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import type { Type } from '../types/Type.js'
import { indent, toLowerCamelCase } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftEnumType } from './types/SwiftEnumType.js'
import { getImportsCode } from '../getImportCode.js'
import { getProtocolConformanceImports } from './getSwiftImports.js'

export function createSwiftEnumBridge(type: SwiftEnumType): SourceFile[] {
  const enumType = type.type
  const protocolConformances = type.getProtocolConformances()
  const protocolNames = protocolConformances.map((conformance) => conformance.name)
  const baseTypes = ['Int32', ...protocolNames]
  const protocolImports = getProtocolConformanceImports(protocolConformances)
  const imports = getImportsCode(protocolImports)
  const enumCases = enumType.enumMembers.map((m) => `case \`${toLowerCamelCase(m.name)}\` = ${m.value}`)
  const initializeCases = enumType.enumMembers.map((m) =>
    `
case "${m.stringValue}":
  self = .${toLowerCamelCase(m.name)}
`.trim()
  )
  const toStringCases = enumType.enumMembers.map((m) =>
    `
case .${toLowerCamelCase(m.name)}:
  return "${m.stringValue}"
`.trim()
  )

  const swiftCode = `
${createFileMetadataString(`${enumType.enumName}.swift`)}

${imports}

/**
 * Represents the JS ${enumType.jsType} \`${enumType.enumName}\`.
 */
@_expose(Cxx)
public enum ${enumType.enumName}: ${baseTypes.join(', ')} {
  ${indent(enumCases.join('\n'), '  ')}

  public static func fromRawValue(_ value: Int32) -> Self {
    return Self(rawValue: value)!
  }
}

public extension ${enumType.enumName} {
  /**
   * Get a ${enumType.enumName} for the given String value, or
   * return \`nil\` if the given value was invalid/unknown.
   */
  init?(fromString string: String) {
    switch string {
      ${indent(initializeCases.join('\n'), '      ')}
      default:
        return nil
    }
  }

  /**
   * Get the String value this ${enumType.enumName} represents.
   */
  var stringValue: String {
    switch self {
      ${indent(toStringCases.join('\n'), '      ')}
    }
  }

  var description: String {
    return stringValue
  }
}
`.trim()

  const swiftFile: SourceFile = {
    content: swiftCode,
    language: 'swift',
    name: `${enumType.enumName}.swift`,
    platform: 'apple',
    subdirectory: [],
  }

  const cppEnumType = type.getCode('c++', { context: 'value' })
  const enumMemberValues = enumType.enumMembers.map((member) => member.value)
  const enumValues = [...new Set(enumMemberValues)]
  let jsToSwiftConverterCode: string
  let swiftToJSConverterCode: string
  let jsCanConvertCode: string
  if (enumType.jsType === 'union') {
    const fromJSICases = enumType.enumMembers.map(
      (member) => `case hashString("${member.stringValue}"): return ${cppEnumType}::fromRawValue(${member.value});`
    )
    const canConvertCases = enumType.enumMembers.map((member) => `case hashString("${member.stringValue}"): return true;`)
    const toJSICases = enumType.enumMembers.map(
      (member) => `case ${member.value}: return createJSIString<"${member.stringValue}">(runtime);`
    )
    jsToSwiftConverterCode = `
const auto string = value.asString(runtime).utf8(runtime);
switch (hashString(string)) {
  ${indent(fromJSICases.join('\n'), '  ')}
  default: [[unlikely]]
    throw std::invalid_argument("Cannot convert \\"" + string + "\\" to enum ${enumType.enumName} - invalid value!");
}
`.trim()
    jsCanConvertCode = `
if (!value.isString()) return false;
const auto string = value.getString(runtime).utf8(runtime);
switch (hashString(string)) {
  ${indent(canConvertCases.join('\n'), '  ')}
  default: return false;
}
`.trim()
    swiftToJSConverterCode = `
switch (value.getRawValue()) {
  ${indent(toJSICases.join('\n'), '  ')}
  default: [[unlikely]]
    throw std::invalid_argument("Cannot convert ${enumType.enumName} to JS - invalid value: " + std::to_string(value.getRawValue()) + "!");
}
`.trim()
  } else {
    const minimum = Math.min(...enumValues)
    const maximum = Math.max(...enumValues)
    const fromJSICases = enumValues.map((raw) => `case ${raw}: return ${cppEnumType}::fromRawValue(${raw});`)
    const canConvertCases = enumValues.map((raw) => `case ${raw}: return true;`)
    // Reject NaN, infinities, and out-of-range values before the integer cast.
    const readInteger = (onInvalid: string) =>
      `
if (!value.isNumber()) { ${onInvalid} }
const double number = value.getNumber();
if (!(number >= ${minimum} && number <= ${maximum})) { ${onInvalid} }
const auto integer = static_cast<int32_t>(number);
if (number != integer) { ${onInvalid} }
`.trim()
    jsToSwiftConverterCode = `
const int integer = doubleToInt(value.asNumber());
switch (integer) {
  ${indent(fromJSICases.join('\n'), '  ')}
  default: [[unlikely]]
    throw std::invalid_argument("Cannot convert " + value.toString(runtime).utf8(runtime) + " to enum ${enumType.enumName} - invalid value!");
}
`.trim()
    swiftToJSConverterCode = 'return jsi::Value(value.getRawValue());'
    const isContiguous = maximum - minimum + 1 === enumValues.length
    let canConvertIntegerBody: string
    if (isContiguous) {
      canConvertIntegerBody = 'return true;'
    } else {
      canConvertIntegerBody = `
switch (integer) {
  ${indent(canConvertCases.join('\n'), '  ')}
  default: return false;
}
`.trim()
    }
    const cannotConvertCode = 'return false;'
    const canConvertIntegerChecks = readInteger(cannotConvertCode)
    jsCanConvertCode = `
${canConvertIntegerChecks}
${canConvertIntegerBody}
`.trim()
  }
  return [
    swiftFile,
    ...createSwiftJSIConverter({
      name: type.name,
      swiftType: type,
      forwardDeclaration: type.forwardDeclaration,
      imports: [
        {
          language: 'c++',
          declaration: {
            header: 'NitroModules/NitroDefines.hpp',
            space: 'system',
          },
        },
        {
          language: 'c++',
          declaration: {
            header: 'NitroModules/NitroHash.hpp',
            space: 'system',
          },
        },
        {
          language: 'c++',
          declaration: {
            header: 'NitroModules/NumberUtils.hpp',
            space: 'system',
          },
        },
        {
          language: 'c++',
          declaration: {
            header: 'NitroModules/JSIString.hpp',
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

interface SwiftEnumCppConverterOptions {
  type: SwiftEnumType
  cppType: Type
}

export function createSwiftEnumCppConverter({ type, cppType }: SwiftEnumCppConverterOptions): SwiftCppConverter {
  const enumType = getTypeAs(cppType, EnumType)
  const nativeEnumType = enumType.getCode('c++', { context: 'value', fullyQualified: true })
  const swiftToCppConverterCode = `
return static_cast<${nativeEnumType}>(value.getRawValue());
`.trim()
  const enumValues = [...new Set(enumType.enumMembers.map((member) => member.value))]
  const enumMemberComparisons = enumValues.map((value) => `rawValue != ${value}`)
  const cppToSwiftConverterCode = `
const auto rawValue = static_cast<int32_t>(value);
#ifdef NITRO_DEBUG
if (${enumMemberComparisons.join(' && ')}) {
  throw std::invalid_argument("Invalid value for ${enumType.enumName}");
}
#endif
return SwiftType::fromRawValue(rawValue);
`.trim()
  const name = `${type.name}+${type.moduleName}`
  return createSwiftConverter({
    name: name,
    cppType: cppType,
    swiftType: type,
    forwardDeclaration: type.forwardDeclaration,
    fromSwift: swiftToCppConverterCode,
    toSwift: cppToSwiftConverterCode,
    imports: [{ language: 'c++', declaration: { header: 'NitroModules/NitroDefines.hpp', space: 'system' } }],
  })
}
