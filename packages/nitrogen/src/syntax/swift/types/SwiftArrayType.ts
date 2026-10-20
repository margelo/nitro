import type { CppHelper } from '../../c++/CppHelper.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { ArrayType } from '../../types/ArrayType.js'
import type { GetCodeOptions, TypeContext } from '../../types/Type.js'
import { getSwiftGenericImport } from '../getSwiftGenericImport.js'
import { wrapSwiftType } from '../wrapSwiftType.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import { SwiftContainerType } from './SwiftContainerType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

export class SwiftArrayType extends ArrayType implements SwiftType {
  override readonly itemType: SwiftType

  constructor(readonly type: ArrayType) {
    const itemType = wrapSwiftType(type.itemType)
    super(itemType)
    this.itemType = itemType
  }

  get isHashable(): boolean {
    return this.itemType.isHashable
  }

  get isSendable(): boolean {
    return this.itemType.isSendable
  }

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }

  get isReferenceType(): boolean {
    return false
  }
  get requiresSwiftGenericContext(): boolean {
    return this.itemType.requiresSwiftGenericContext
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
    return false
  }
  get requiresExplicitSwiftTarget(): boolean {
    return this.itemType.requiresExplicitSwiftTarget
  }
  get needsSwiftConversion(): boolean {
    return this.itemType.needsSwiftConversion
  }
  fromSwift(value: string): string {
    if (this.needsSwiftConversion) {
      return `${value}.map { ${this.itemType.fromSwift('$0')} }`
    }
    return value
  }
  toSwift(value: string): string {
    if (this.needsSwiftConversion) {
      return `${value}.map { ${this.itemType.toSwift('$0')} }`
    }
    return value
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    const itemCode = this.itemType.getCode(language, {
      ...options,
      context: 'type-argument',
    })
    switch (language) {
      case 'c++': {
        const type = `swift::Array<${itemCode}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return `[${itemCode}]`
      default:
        return super.getCode(language, options)
    }
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(context: TypeContext): string {
    const item = this.itemType.getClangImporterName('type-argument')
    return getClangImporterReferenceName(`swift.Array<${item}>`, context)
  }

  override getExtraFiles(): SourceFile[] {
    return this.itemType.getExtraFiles()
  }

  get requiredCppHelpers(): CppHelper[] {
    return this.itemType.requiredCppHelpers
  }

  override getRequiredImports(
    language: Language,
    context: 'declaration' | 'implementation' = 'implementation'
  ): SourceImport[] {
    const imports = this.itemType.getRequiredImports(language, context)
    switch (language) {
      case 'c++':
        imports.push(
          getSwiftGenericImport(
            'Array',
            'NitroModules/JSIConverter+SwiftArray.hpp'
          )
        )
        break
    }
    return imports
  }
}
