import { getUmbrellaHeaderName } from '../../autolinking/apple/createSwiftUmbrellaHeader.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import { getImportsCode } from '../getImportCode.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { SwiftType } from './types/SwiftType.js'

interface SwiftJSIConverterImplementation {
  name: string
  swiftType: SwiftType
  forwardDeclaration: string
  fromJSI: string
  toJSI: string
  canConvert: string
  preparation?: {
    preparedType: string
    prepareFromJSI: string
    fromPreparedJSI: string
  }
  imports?: SourceImport[]
}

/** The Swift API module owns conversion between its values and JavaScript. */
export function createSwiftJSIConverter({
  name,
  swiftType,
  forwardDeclaration,
  fromJSI,
  toJSI,
  canConvert,
  preparation,
  imports = [],
}: SwiftJSIConverterImplementation): SourceFile[] {
  const converterName = `${name}-Swift`
  const cppSwiftType = swiftType.getCode('c++', { context: 'value' })
  const declarationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: { header: 'NitroModules/JSIConverter.hpp', space: 'system' },
    },
    {
      language: 'c++',
      declaration: { forwardDeclaration: forwardDeclaration },
    },
  ]
  const declarationCode = `
static ${cppSwiftType} fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
static jsi::Value toJSI(jsi::Runtime& runtime, const ${cppSwiftType}& value);
static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
`.trim()
  const fromJSIImplementationCode = `
${cppSwiftType} JSIConverter<${cppSwiftType}>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
  ${indent(fromJSI, '  ')}
}
`.trim()
  const declarations = [declarationCode]
  const fromJSIImplementations = [fromJSIImplementationCode]
  if (preparation != null) {
    declarationImports.push({ language: 'c++', declaration: { header: 'array', space: 'system' } })
    const preparationDeclarationCode = `
using Prepared = ${preparation.preparedType};
static std::optional<Prepared> prepareFromJSI(jsi::Runtime& runtime, const jsi::Value& value);
static ${cppSwiftType} fromPreparedJSI(jsi::Runtime& runtime, Prepared&& fields);
`.trim()
    declarations.push(preparationDeclarationCode)
    const preparationImplementationCode = `
std::optional<JSIConverter<${cppSwiftType}>::Prepared> JSIConverter<${cppSwiftType}>::prepareFromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
  ${indent(preparation.prepareFromJSI, '  ')}
}

${cppSwiftType} JSIConverter<${cppSwiftType}>::fromPreparedJSI(jsi::Runtime& runtime, Prepared&& fields) {
  ${indent(preparation.fromPreparedJSI, '  ')}
}
`.trim()
    fromJSIImplementations.push(preparationImplementationCode)
  }
  const declarationIncludes = getImportsCode(declarationImports, 'declaration')
  const implementationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: NitroConfig.current.getCxxHeader(`${converterName}.hpp`, 'private'),
    },
    {
      language: 'c++',
      declaration: NitroConfig.current.getCxxHeader(getUmbrellaHeaderName(), 'private'),
    },
    ...imports,
  ]
  const implementationIncludes = getImportsCode(implementationImports, 'implementation')
  const cppHeaderCode = `
${createFileMetadataString(`${converterName}.hpp`)}

#pragma once

${declarationIncludes}

namespace margelo::nitro {

  template <>
  struct JSIConverter<${cppSwiftType}> {
    ${indent(declarations.join('\n\n'), '    ')}
  };

} // namespace margelo::nitro
`.trim()
  const cppImplementationCode = `
${createFileMetadataString(`${converterName}.cpp`)}

${implementationIncludes}

namespace margelo::nitro {

  ${indent(fromJSIImplementations.join('\n\n'), '  ')}

  jsi::Value JSIConverter<${cppSwiftType}>::toJSI(jsi::Runtime& runtime, const ${cppSwiftType}& value) {
    ${indent(toJSI, '    ')}
  }

  bool JSIConverter<${cppSwiftType}>::canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    ${indent(canConvert, '    ')}
  }

} // namespace margelo::nitro
`.trim()
  return [
    {
      name: `${converterName}.hpp`,
      language: 'c++',
      platform: 'apple',
      subdirectory: [],
      content: cppHeaderCode,
    },
    {
      name: `${converterName}.cpp`,
      language: 'c++',
      platform: 'apple',
      subdirectory: [],
      content: cppImplementationCode,
    },
  ]
}
