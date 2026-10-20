import type {
  FileWithReferencedTypes,
  SourceFile,
  SourceImport,
} from '../SourceFile.js'
import { indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { NamedType } from '../types/Type.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import type { GetCallbackCodeOptions } from '../types/CallbackType.js'
import { getImportsCode } from '../getImportCode.js'

export function createCppStruct(
  typename: string,
  properties: NamedType[]
): [header: FileWithReferencedTypes, implementation: SourceFile] {
  // Namespace typename
  const fullyQualifiedTypename = NitroConfig.current.getCxxNamespace(
    'c++',
    typename
  )
  // Get C++ code for all struct members
  const cppStructProps = properties
    .map(
      (p) =>
        `${p.getCode('c++', { context: 'property' })} ${p.escapedName}     SWIFT_PRIVATE;`
    )
    .join('\n')
  const cppConstructorParams = properties
    .map((p) => `${p.getCode('c++', { context: 'value' })} ${p.escapedName}`)
    .join(', ')
  // Parameters are taken by value, so move the ones that are expensive to copy
  // (the types that other signatures pass by `const&`) into the members.
  const movedProperties = properties.filter(
    (p) =>
      p.getCode('c++', { context: 'parameter' }) !==
      p.getCode('c++', { context: 'value' })
  )
  const cppInitializerParams = properties
    .map((p) => {
      if (movedProperties.includes(p)) {
        return `${p.escapedName}(std::move(${p.escapedName}))`
      }
      return `${p.escapedName}(${p.escapedName})`
    })
    .join(', ')
  // Get C++ code for converting each member from a jsi::Value
  const codeOptions: GetCallbackCodeOptions = {
    context: 'type-argument',
    fullyQualified: true,
    includeNameInfo: false,
  }
  const cppFromJsiParams = properties
    .map(
      (p) =>
        `JSIConverter<${p.getCode('c++', codeOptions)}>::fromJSI(runtime, obj.getProperty(runtime, PropNameIDCache::get(runtime, "${p.name}")))`
    )
    .join(',\n')
  // Get C++ code for converting each member to a jsi::Value
  const cppToJsiCalls = properties
    .map(
      (p) =>
        `obj.setProperty(runtime, PropNameIDCache::get(runtime, "${p.name}"), JSIConverter<${p.getCode('c++', codeOptions)}>::toJSI(runtime, arg.${p.escapedName}));`
    )
    .join('\n')
  // Get C++ code for verifying if jsi::Value can be converted to type
  const cppCanConvertCalls = properties
    .map(
      (p) =>
        `if (!JSIConverter<${p.getCode('c++', codeOptions)}>::canConvert(runtime, obj.getProperty(runtime, PropNameIDCache::get(runtime, "${p.name}")))) return false;`
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
  const declarationImports: SourceImport[] = [
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
    ...includedTypes,
  ]
  if (movedProperties.length > 0) {
    declarationImports.push({
      language: 'c++',
      declaration: { name: 'utility', space: 'system' },
    })
  }
  const implementationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: NitroConfig.current.getCxxHeader(`${typename}.hpp`),
    },
    {
      language: 'c++',
      declaration: {
        name: 'NitroModules/JSIHelpers.hpp',
        space: 'system',
      },
    },
    {
      language: 'c++',
      declaration: {
        name: 'NitroModules/PropNameIDCache.hpp',
        space: 'system',
      },
    },
    ...includedTypes,
  ]
  const cppDeclarationIncludes = getImportsCode(
    declarationImports,
    'declaration'
  )
  const cppImplementationIncludes = getImportsCode(
    implementationImports,
    'implementation'
  )
  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')

  const cppCode = `
${createFileMetadataString(`${typename}.hpp`)}

#pragma once

${cppDeclarationIncludes}

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
    static ${fullyQualifiedTypename} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg);
    static jsi::Value toJSI(jsi::Runtime& runtime, const ${fullyQualifiedTypename}& arg);
    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
  };

} // namespace margelo::nitro
  `
  const cppImplementationCode = `
${createFileMetadataString(`${typename}.cpp`)}

${cppImplementationIncludes}

namespace margelo::nitro {

  ${fullyQualifiedTypename} JSIConverter<${fullyQualifiedTypename}>::fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    jsi::Object obj = arg.asObject(runtime);
    return ${fullyQualifiedTypename}(
      ${indent(cppFromJsiParams, '      ')}
    );
  }

  jsi::Value JSIConverter<${fullyQualifiedTypename}>::toJSI(jsi::Runtime& runtime, const ${fullyQualifiedTypename}& arg) {
    jsi::Object obj(runtime);
    ${indent(cppToJsiCalls, '    ')}
    return obj;
  }

  bool JSIConverter<${fullyQualifiedTypename}>::canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) {
      return false;
    }
    jsi::Object obj = value.getObject(runtime);
    if (!nitro::isPlainObject(runtime, obj)) {
      return false;
    }
    ${indent(cppCanConvertCalls, '    ')}
    return true;
  }

} // namespace margelo::nitro
  `
  return [
    {
      content: cppCode,
      name: `${typename}.hpp`,
      subdirectory: [],
      language: 'c++',
      referencedTypes: properties,
      platform: 'shared',
    },
    {
      content: cppImplementationCode,
      name: `${typename}.cpp`,
      subdirectory: [],
      language: 'c++',
      platform: 'shared',
    },
  ]
}
