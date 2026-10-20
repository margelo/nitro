import type { Type } from '../types/Type.js'
import { wrapSwiftType } from './wrapSwiftType.js'
import { getUmbrellaHeaderName } from '../../autolinking/ios/createSwiftUmbrellaHeader.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import { getImportsCode } from '../getImportCode.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { SwiftType } from './types/SwiftType.js'

export function getSwiftConverter(
  type: Type,
  context: 'value' | 'parameter-type' = 'value',
  swiftRepresentation: SwiftType = wrapSwiftType(type)
): string {
  const cppType = type.getCode('c++', {
    fullyQualified: true,
    context,
  })
  // Inline parameters keep their borrowed representation on both sides.
  const swiftContext =
    context === 'parameter-type' ? 'parameter-type' : 'type-argument'
  const swiftType = swiftRepresentation.getCode('c++', {
    context: swiftContext,
  })
  return `SwiftConverter<${cppType}, ${swiftType}>`
}

interface SwiftConverterImplementation {
  name: string
  cppType: Type
  swiftType: SwiftType
  forwardDeclaration: string
  fromSwift: string
  toSwift: string
  fromJSI: string
  toJSI: string
  canConvert: string
  imports?: SourceImport[]
}

/** Emit both native and JSI converters for a generated Swift type. */
export function createSwiftConverter({
  name,
  cppType: type,
  swiftType,
  forwardDeclaration,
  fromSwift,
  toSwift,
  fromJSI,
  toJSI,
  canConvert,
  imports = [],
}: SwiftConverterImplementation): SourceFile[] {
  const converterName = `${name}-Swift`
  const cppType = type.getCode('c++', {
    context: 'type-argument',
    fullyQualified: true,
  })
  const cppSwiftType = swiftType.getCode('c++', { context: 'value' })
  let specialization: string
  if (swiftType.requiresExplicitSwiftTarget) {
    specialization = `SwiftConverter<${cppType}, ${swiftType.getCode('c++', { context: 'type-argument' })}>`
  } else {
    specialization = `SwiftConverter<${cppType}>`
  }
  const cppImports = type.getRequiredImports('c++')
  const declarationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: {
        name: 'NitroModules/SwiftConverter_fwd.hpp',
        space: 'system',
      },
    },
    {
      language: 'c++',
      declaration: { name: 'NitroModules/JSIConverter.hpp', space: 'system' },
    },
    ...cppImports,
    {
      language: 'c++',
      declaration: { forwardDeclaration: forwardDeclaration },
    },
  ]
  const declarationIncludes = getImportsCode(declarationImports, 'declaration')
  const implementationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: NitroConfig.current.getCxxHeader(
        `${converterName}.hpp`,
        'private'
      ),
    },
    {
      language: 'c++',
      declaration: NitroConfig.current.getCxxHeader(
        getUmbrellaHeaderName(),
        'private'
      ),
    },
    {
      language: 'c++',
      declaration: {
        name: 'NitroModules/SwiftConverter.hpp',
        space: 'system',
      },
    },
    ...cppImports,
    ...imports,
  ]
  const implementationIncludes = getImportsCode(
    implementationImports,
    'implementation'
  )

  const cppHeaderCode = `
${createFileMetadataString(`${converterName}.hpp`)}

#pragma once

${declarationIncludes}

namespace margelo::nitro {

  template <>
  struct ${specialization} final {
    using SwiftType = ${cppSwiftType};

    static ${cppType} fromSwift(const SwiftType& value);
    static SwiftType toSwift(const ${cppType}& value);
  };

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

  ${cppType} ${specialization}::fromSwift(const SwiftType& value) {
    ${indent(fromSwift, '    ')}
  }

  ${specialization}::SwiftType ${specialization}::toSwift(const ${cppType}& value) {
    ${indent(toSwift, '    ')}
  }

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
