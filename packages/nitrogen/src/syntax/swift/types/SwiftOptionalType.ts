import type { CppHelper } from '../../c++/CppHelper.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { OptionalType } from '../../types/OptionalType.js'
import type { GetCodeOptions, TypeContext } from '../../types/Type.js'
import { getSwiftGenericImport } from '../getSwiftGenericImport.js'
import { wrapSwiftType } from '../wrapSwiftType.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import { SwiftContainerType } from './SwiftContainerType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

export class SwiftOptionalType extends OptionalType implements SwiftType {
  override readonly wrappingType: SwiftType

  constructor(readonly type: OptionalType) {
    const wrappingType = wrapSwiftType(type.wrappingType)
    super(wrappingType)
    this.wrappingType = wrappingType
  }

  get isHashable(): boolean {
    return this.wrappingType.isHashable
  }

  get isSendable(): boolean {
    return this.wrappingType.isSendable
  }

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }

  get isReferenceType(): boolean {
    return false
  }
  get requiresSwiftGenericContext(): boolean {
    return this.wrappingType.requiresSwiftGenericContext
  }

  /** Keep the entire native container together, including nested containers. */
  getBridgeType(): SwiftType {
    if (!this.requiresSwiftGenericContext) return this
    return new SwiftContainerType(this)
  }

  get containsSwiftGenerics(): boolean {
    return true
  }

  get canImportFromCpp(): boolean {
    // TODO: Import swift::Optional directly once Swift supports round-tripping it:
    // https://github.com/swiftlang/swift/issues/76024
    return false
  }
  get requiresExplicitSwiftTarget(): boolean {
    return this.wrappingType.requiresExplicitSwiftTarget
  }
  get needsSwiftConversion(): boolean {
    return this.wrappingType.needsSwiftConversion
  }
  fromSwift(value: string): string {
    if (this.needsSwiftConversion) {
      return `${value}.map { ${this.wrappingType.fromSwift('$0')} }`
    }
    return value
  }
  toSwift(value: string): string {
    if (this.needsSwiftConversion) {
      return `${value}.map { ${this.wrappingType.toSwift('$0')} }`
    }
    return value
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const wrapping = this.wrappingType.getCode(language, {
          ...options,
          context: 'type-argument',
        })
        const type = `swift::Optional<${wrapping}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      default:
        return super.getCode(language, options)
    }
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(context: TypeContext): string {
    const wrapping = this.wrappingType.getClangImporterName('type-argument')
    return getClangImporterReferenceName(`swift.Optional<${wrapping}>`, context)
  }

  override getExtraFiles(): SourceFile[] {
    return this.wrappingType.getExtraFiles()
  }

  get requiredCppHelpers(): CppHelper[] {
    return this.wrappingType.requiredCppHelpers
  }

  override getRequiredImports(
    language: Language,
    context: 'declaration' | 'implementation' = 'implementation'
  ): SourceImport[] {
    const imports = this.wrappingType.getRequiredImports(language, context)
    switch (language) {
      case 'c++':
        imports.push(
          getSwiftGenericImport(
            'Optional',
            'NitroModules/JSIConverter+SwiftOptional.hpp'
          )
        )
        break
    }
    return imports
  }
}
