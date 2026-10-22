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
    static ${cppSwiftType} fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
    static jsi::Value toJSI(jsi::Runtime& runtime, const ${cppSwiftType}& value);
    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
  };

} // namespace margelo::nitro
`.trim()
  const cppImplementationCode = `
${createFileMetadataString(`${converterName}.cpp`)}

${implementationIncludes}

namespace margelo::nitro {

  ${cppSwiftType} JSIConverter<${cppSwiftType}>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    ${indent(fromJSI, '    ')}
  }

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
      platform: 'ios',
      subdirectory: [],
      content: cppHeaderCode,
    },
    {
      name: `${converterName}.cpp`,
      language: 'c++',
      platform: 'ios',
      subdirectory: [],
      content: cppImplementationCode,
    },
  ]
}
