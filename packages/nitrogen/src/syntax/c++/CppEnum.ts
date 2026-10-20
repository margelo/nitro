import { NitroConfig } from '../../config/NitroConfig.js'
import { indent, toLowerCamelCase } from '../../utils.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { createFileMetadataString } from '../helpers.js'
import type { EnumMember } from '../types/EnumType.js'
import { getImportsCode } from '../getImportCode.js'

/**
 * Creates a C++ enum that converts to a JS enum (aka just int)
 */
export function createCppEnum(
  typename: string,
  enumMembers: EnumMember[]
): SourceFile {
  // Namespace typename
  const fullyQualifiedTypename = NitroConfig.current.getCxxNamespace(
    'c++',
    typename
  )
  // Map enum to C++ code
  const cppEnumMembers = enumMembers
    .map(
      (m) =>
        `${m.name}      SWIFT_NAME(${toLowerCamelCase(m.name)}) = ${m.value},`
    )
    .join('\n')
  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')

  // Aliases share a value, so only emit one case for each number.
  const membersByValue = new Map<number, EnumMember>()
  for (const member of enumMembers) {
    membersByValue.set(member.value, member)
  }
  const uniqueMembers = [...membersByValue.values()]
  const fromJSICases = uniqueMembers.map((member) =>
    `
case ${member.value}: return ${fullyQualifiedTypename}::${member.name};
    `.trim()
  )
  const canConvertCases = uniqueMembers.map((member) =>
    `
case ${member.value}: return true;
    `.trim()
  )

  const imports: SourceImport[] = [
    {
      language: 'c++',
      declaration: {
        name: 'NitroModules/JSIConverter.hpp',
        space: 'system',
      },
    },
    {
      language: 'c++',
      declaration: {
        name: 'NitroModules/NitroDefines.hpp',
        space: 'system',
      },
    },
    {
      language: 'c++',
      declaration: {
        name: 'NitroModules/NumberUtils.hpp',
        space: 'system',
      },
    },
  ]

  // Create entire C++ file
  const cppCode = `
${createFileMetadataString(`${typename}.hpp`)}

#pragma once

${getImportsCode(imports)}

namespace ${cxxNamespace} {

  /**
   * An enum which can be represented as a JavaScript enum (${typename}).
   */
  enum class ${typename} {
    ${indent(cppEnumMembers, '    ')}
  } CLOSED_ENUM;

} // namespace ${cxxNamespace}

namespace margelo::nitro {

  // C++ ${typename} <> JS ${typename} (enum)
  template <>
  struct JSIConverter<${fullyQualifiedTypename}> final {
    static inline ${fullyQualifiedTypename} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
      int integer = doubleToInt(arg.asNumber());
      switch (integer) {
        ${indent(fromJSICases.join('\n'), '        ')}
        default: [[unlikely]]
          throw std::invalid_argument("Cannot convert " + arg.toString(runtime).utf8(runtime) + " to enum ${typename} - invalid value!");
      }
    }
    static inline jsi::Value toJSI(jsi::Runtime& runtime, ${fullyQualifiedTypename} arg) {
      int enumValue = static_cast<int>(arg);
      return JSIConverter<int>::toJSI(runtime, enumValue);
    }
    static inline bool canConvert(jsi::Runtime&, const jsi::Value& value) {
      if (!value.isNumber()) {
        return false;
      }
      auto integer = tryDoubleToInt(value.getNumber());
      if (!integer.has_value()) {
        return false;
      }
      switch (*integer) {
        ${indent(canConvertCases.join('\n'), '        ')}
        default: return false;
      }
    }
  };

} // namespace margelo::nitro
        `.trim()

  return {
    content: cppCode,
    subdirectory: [],
    name: `${typename}.hpp`,
    language: 'c++',
    platform: 'shared',
  }
}
