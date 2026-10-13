import type { FileWithReferencedTypes } from '../SourceFile.js'
import { indent } from '../../utils.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { NamedType } from '../types/Type.js'
import { includeHeader, includeNitroHeader } from './includeNitroHeader.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import type { GetFunctionCodeOptions } from '../types/FunctionType.js'

export function createCppStruct(
  typename: string,
  properties: NamedType[]
): FileWithReferencedTypes {
  // Namespace typename
  const fullyQualifiedTypename = NitroConfig.current.getCxxNamespace(
    'c++',
    typename
  )
  // Get C++ code for all struct members
  const cppStructProps = properties
    .map((p) => `${p.getCode('c++')} ${p.escapedName}     SWIFT_PRIVATE;`)
    .join('\n')
  const cppConstructorParams = properties
    .map((p) => `${p.getCode('c++')} ${p.escapedName}`)
    .join(', ')
  const cppInitializerParams = properties
    .map((p) => `${p.escapedName}(${p.escapedName})`)
    .join(', ')
  // Get C++ code for converting each member from a jsi::Value
  const codeOptions: GetFunctionCodeOptions = {
    fullyQualified: true,
    includeNameInfo: false,
  }
  // A batch lookup only pays off when it replaces multiple name lookups.
  const usesPropertyNameBatch = properties.length >= 2
  const getPropertyName = (property: NamedType, index: number): string =>
    usesPropertyNameBatch
      ? `propertyNames[${index}]`
      : `PropNameIDCache::get(runtime, "${property.name}")`
  const cppPreparePropertyNames = usesPropertyNameBatch
    ? 'const PropNameIDCache::BatchHandle propertyNames = getPropertyNames(runtime);\n      '
    : ''
  const cppPropertyNameCache = usesPropertyNameBatch
    ? `  private:
    static inline PropNameIDCache::BatchHandle getPropertyNames(jsi::Runtime& runtime) {
      static constexpr std::array<std::string_view, ${properties.length}> names = { ${properties.map((property) => `"${property.name}"`).join(', ')} };
      return PropNameIDCache::getBatch(runtime, &names, names);
    }

  public:
`
    : ''
  const cppFromJsiParams = properties
    .map(
      (p, index) =>
        `JSIConverter<${p.getCode('c++', codeOptions)}>::fromJSI(runtime, obj.getProperty(runtime, ${getPropertyName(p, index)}))`
    )
    .join(',\n')
  // Get C++ code for converting each member to a jsi::Value
  const cppToJsiCalls = properties
    .map(
      (p, index) =>
        `obj.setProperty(runtime, ${getPropertyName(p, index)}, JSIConverter<${p.getCode('c++', codeOptions)}>::toJSI(runtime, arg.${p.escapedName}));`
    )
    .join('\n')
  // Get C++ code for verifying if jsi::Value can be converted to type
  const cppCanConvertCalls = properties
    .map(
      (p, index) =>
        `if (!JSIConverter<${p.getCode('c++', codeOptions)}>::canConvert(runtime, obj.getProperty(runtime, ${getPropertyName(p, index)}))) return false;`
    )
    .join('\n')

  // Only equatable types have an operator== overload
  let equatableFunc: string
  const isEquatable = properties.every((p) => p.isEquatable)
  if (isEquatable) {
    equatableFunc = `friend bool operator==(const ${typename}& lhs, const ${typename}& rhs) = default;`
  } else {
    const nonEquatableTypes = properties
      .filter((p) => !p.isEquatable)
      .map((p) => p.name)
    equatableFunc = `// ${typename} is not equatable because these properties are not equatable: ${nonEquatableTypes.join(', ')}`
  }

  // Get C++ includes for each extra-file we need to include
  const includedTypes = properties.flatMap((r) => r.getRequiredImports('c++'))
  const cppForwardDeclarations = includedTypes
    .map((i) => i.forwardDeclaration)
    .filter((v) => v != null)
    .filter(isNotDuplicate)
  const cppExtraIncludes = includedTypes
    .map((i) => includeHeader(i))
    .filter(isNotDuplicate)
  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')

  const cppCode = `
${createFileMetadataString(`${typename}.hpp`)}

#pragma once

${includeNitroHeader('JSIConverter.hpp')}
${includeNitroHeader('NitroDefines.hpp')}
${includeNitroHeader('JSIHelpers.hpp')}
${includeNitroHeader('PropNameIDCache.hpp')}

${usesPropertyNameBatch ? '#include <array>\n#include <string_view>\n\n' : ''}${cppForwardDeclarations.join('\n')}

${cppExtraIncludes.join('\n')}

namespace ${cxxNamespace} {

  /**
   * A struct which can be represented as a JavaScript object (${typename}).
   */
  struct ${typename} final {
  public:
    ${indent(cppStructProps, '    ')}

  public:
    ${typename}() = default;
    explicit ${typename}(${cppConstructorParams}): ${cppInitializerParams} {}

  public:
    ${indent(equatableFunc, '    ')}
  };

} // namespace ${cxxNamespace}

namespace margelo::nitro {

  // C++ ${typename} <> JS ${typename} (object)
  template <>
  struct JSIConverter<${fullyQualifiedTypename}> final {
${cppPropertyNameCache}    static inline ${fullyQualifiedTypename} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
      jsi::Object obj = arg.asObject(runtime);
      ${cppPreparePropertyNames}return ${fullyQualifiedTypename}(
        ${indent(cppFromJsiParams, '        ')}
      );
    }
    static inline jsi::Value toJSI(jsi::Runtime& runtime, const ${fullyQualifiedTypename}& arg) {
      jsi::Object obj(runtime);
      ${cppPreparePropertyNames}${indent(cppToJsiCalls, '      ')}
      return obj;
    }
    static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
      if (!value.isObject()) {
        return false;
      }
      jsi::Object obj = value.getObject(runtime);
      if (!nitro::isPlainObject(runtime, obj)) {
        return false;
      }
      ${cppPreparePropertyNames}${indent(cppCanConvertCalls, '      ')}
      return true;
    }
  };

} // namespace margelo::nitro
  `
  return {
    content: cppCode,
    name: `${typename}.hpp`,
    subdirectory: [],
    language: 'c++',
    referencedTypes: properties,
    platform: 'shared',
  }
}
