import type { Type } from '../types/Type.js'
import { wrapSwiftType } from './wrapSwiftType.js'
import { getUmbrellaHeaderName } from '../../autolinking/apple/createSwiftUmbrellaHeader.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import { getImportsCode } from '../getImportCode.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { SwiftType } from './types/SwiftType.js'

interface GetSwiftConverterOptions {
  cppType: Type
  context?: 'value' | 'parameter-type'
  swiftType?: SwiftType
}

export function getSwiftConverter({
  cppType: type,
  context = 'value',
  swiftType: swiftRepresentation = wrapSwiftType(type),
}: GetSwiftConverterOptions): string {
  const cppType = type.getCode('c++', {
    fullyQualified: true,
    context: context,
  })
  const swiftContext = context === 'parameter-type' ? 'parameter-type' : 'type-argument'
  const swiftType = swiftRepresentation.getCode('c++', { context: swiftContext, fullyQualified: true })
  return `SwiftConverter<${cppType}, ${swiftType}>`
}

/** Native converter files and imports explicitly requested by a C++ consumer. */
export interface SwiftCppConverter {
  imports: SourceImport<'c++'>[]
  files: SourceFile[]
}

interface SwiftConverterImplementation {
  name: string
  cppType: Type
  swiftType: SwiftType
  forwardDeclaration: string
  fromSwift: string
  toSwift: string
  imports?: SourceImport[]
  dependencies?: SwiftCppConverter[]
}

/** Native C++ conversion is separate from a Swift API's JSI bindings. */
export function createSwiftConverter({
  name,
  cppType: type,
  swiftType,
  forwardDeclaration,
  fromSwift,
  toSwift,
  imports = [],
  dependencies = [],
}: SwiftConverterImplementation): SwiftCppConverter {
  const converterName = `${name}-SwiftConverter`
  const cppType = type.getCode('c++', { context: 'type-argument', fullyQualified: true })
  const cppSwiftType = swiftType.getCode('c++', { context: 'value' })
  let specialization: string
  if (swiftType.requiresExplicitSwiftTarget) {
    const swiftTarget = swiftType.getCode('c++', { context: 'type-argument' })
    specialization = `SwiftConverter<${cppType}, ${swiftTarget}>`
  } else {
    specialization = `SwiftConverter<${cppType}>`
  }
  const header: SourceImport<'c++'> = {
    language: 'c++',
    declaration: NitroConfig.current.getCxxHeader(`${converterName}.hpp`, 'private'),
  }
  const declarationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: { header: 'NitroModules/SwiftConverter_fwd.hpp', space: 'system' },
    },
    ...type.getRequiredImports('c++'),
    {
      language: 'c++',
      declaration: { forwardDeclaration: forwardDeclaration },
    },
  ]
  const declarationIncludes = getImportsCode(declarationImports, 'declaration')
  const dependencyImports = dependencies.flatMap((dependency) => dependency.imports)
  const implementationImports: SourceImport[] = [
    header,
    {
      language: 'c++',
      declaration: NitroConfig.current.getCxxHeader(getUmbrellaHeaderName(), 'private'),
    },
    {
      language: 'c++',
      declaration: { header: 'NitroModules/SwiftConverter.hpp', space: 'system' },
    },
    ...type.getRequiredImports('c++'),
    ...dependencyImports,
    ...imports,
  ]
  const implementationIncludes = getImportsCode(implementationImports, 'implementation')
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

} // namespace margelo::nitro
`.trim()
  const dependencyFiles = dependencies.flatMap((dependency) => dependency.files)
  return {
    imports: [header, ...dependencyImports],
    files: [
      ...dependencyFiles,
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
    ],
  }
}

/** Generic runtime conversions only need their generated payload converters. */
export function combineSwiftCppConverters(converters: (SwiftCppConverter | undefined)[]): SwiftCppConverter {
  const required = converters.filter((converter) => converter != null)
  return {
    imports: required.flatMap((converter) => converter.imports),
    files: required.flatMap((converter) => converter.files),
  }
}
