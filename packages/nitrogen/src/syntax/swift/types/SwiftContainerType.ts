import type { Language } from '../../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../../c++/getForwardDeclaration.js'
import { createFileMetadataString, escapeCppName } from '../../helpers.js'
import { getImportsCode } from '../../getImportCode.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { Type, GetCodeOptions, TypeContext } from '../../types/Type.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import { createSwiftConverter, getSwiftConverter, type SwiftCppConverter } from '../SwiftConverter.js'
import { createSwiftJSIConverter } from '../SwiftJSIConverter.js'
import { getSwiftImports } from '../getSwiftImports.js'
import type { SwiftArrayType } from './SwiftArrayType.js'
import { SwiftNamedType } from './SwiftNamedType.js'
import type { SwiftOptionalType } from './SwiftOptionalType.js'

// TODO: Remove this workaround once our minimum Xcode ships
// https://github.com/swiftlang/swift/pull/93389 and
// https://github.com/swiftlang/swift/pull/93431, and Nitrogen includes -Swift.h
// before the local bridge with -emit-clang-header-nonmodular-includes enabled.
/** A concrete Swift value that keeps an entire native container in its original storage. */
export class SwiftContainerType extends SwiftNamedType {
  constructor(readonly container: SwiftArrayType | SwiftOptionalType) {
    const nativeName = container.getCode('c++', { context: 'type-argument' })
    super(`SwiftContainer_${escapeCppName(nativeName)}`, container)
  }

  override getCppConverter(cppType: Type): SwiftCppConverter {
    const converter = getSwiftConverter({ cppType: cppType, swiftType: this.container })
    const swiftToCppConverterCode = `
return ${converter}::fromSwift(value.getValue());
`.trim()
    const cppToSwiftConverterCode = `
return SwiftType::init(${converter}::toSwift(value));
`.trim()
    return createSwiftConverter({
      name: `${this.name}+${this.moduleName}`,
      cppType: cppType,
      swiftType: this,
      forwardDeclaration: this.forwardDeclaration,
      fromSwift: swiftToCppConverterCode,
      toSwift: cppToSwiftConverterCode,
      dependencies: [this.container.getCppConverter(cppType)],
      imports: this.container.getRequiredImports('c++', 'implementation'),
    })
  }

  override get canImportFromCpp(): boolean {
    return false
  }
  override get requiresSwiftGenericContext(): boolean {
    return true
  }
  override get requiresExplicitSwiftTarget(): boolean {
    return true
  }
  override get needsSwiftConversion(): boolean {
    return true
  }
  override fromSwift(value: string): string {
    return `${this.name}(${this.container.fromSwift(value)})`
  }
  override toSwift(value: string): string {
    return this.container.toSwift(`${value}.value`)
  }

  private get moduleName(): string {
    return this.container.config.getAppleModuleName()
  }
  private get forwardDeclaration(): string {
    return getForwardDeclaration('class', this.name, this.moduleName)
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = `::${this.moduleName}::${this.name}`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return this.name
      default:
        return this.container.getCode(language, options)
    }
  }
  override getClangImporterName(context: TypeContext): string {
    return getClangImporterReferenceName(`${this.moduleName}.${this.name}`, context)
  }

  override getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    switch (language) {
      case 'c++': {
        const imports: SourceImport[] = [
          {
            language: language,
            declaration: { forwardDeclaration: this.forwardDeclaration },
          },
        ]
        if (context === 'implementation') {
          imports.push(...this.container.getRequiredImports(language, context), {
            language: language,
            declaration: this.container.config.getCxxHeader(`${this.name}-Swift.hpp`, 'private'),
          })
        }
        return imports
      }
      default:
        return this.container.getRequiredImports(language, context)
    }
  }

  override getExtraFiles(): SourceFile[] {
    if (this.container.config.isExternalConfig) return []
    const swiftType = this.container.getCode('swift', {
      context: 'type-argument',
    })
    const cppType = this.container.getCode('c++', { context: 'type-argument' })
    const wrapperType = this.getCode('c++', { context: 'type-argument' })
    const swiftImports = getImportsCode(getSwiftImports([this.container], 'public'))
    const swiftCode = `
${createFileMetadataString(`${this.name}.swift`)}

${swiftImports}

// TODO: Remove when our minimum Xcode includes
// https://github.com/swiftlang/swift/pull/93389 and
// https://github.com/swiftlang/swift/pull/93431, and Nitrogen includes -Swift.h
// before the local bridge with -emit-clang-header-nonmodular-includes enabled.
@_expose(Cxx)
public struct ${this.name} {
  public let value: ${swiftType}

  public init(_ value: consuming ${swiftType}) {
    self.value = value
  }
}
`.trim()
    const jsToSwiftConverterCode = `
return ${wrapperType}::init(JSIConverter<${cppType}>::fromJSI(runtime, value));
`.trim()
    const swiftToJSConverterCode = `
return JSIConverter<${cppType}>::toJSI(runtime, value.getValue());
`.trim()
    const jsCanConvertCode = `
return JSIConverter<${cppType}>::canConvert(runtime, value);
`.trim()
    return [
      ...this.container.getExtraFiles(),
      {
        name: `${this.name}.swift`,
        language: 'swift',
        platform: 'apple',
        subdirectory: [],
        content: swiftCode,
      },
      ...createSwiftJSIConverter({
        name: this.name,
        swiftType: this,
        forwardDeclaration: this.forwardDeclaration,
        imports: this.container.getRequiredImports('c++', 'implementation'),
        fromJSI: jsToSwiftConverterCode,
        toJSI: swiftToJSConverterCode,
        canConvert: jsCanConvertCode,
      }),
    ]
  }
}
