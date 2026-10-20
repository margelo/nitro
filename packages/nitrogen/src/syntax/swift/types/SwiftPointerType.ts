import type { Language } from '../../../getPlatformSpecs.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions } from '../../types/Type.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

/**
 * A raw pointer that carries a bridge value across the C++ boundary when Swift
 * cannot import or export the value's type directly. `fromSwift` and `toSwift`
 * convert as far as one expression can; subclasses create and fill pointers.
 */
export abstract class SwiftPointerType implements SwiftType {
  readonly kind = 'unsafe-void-pointer'
  readonly isEquatable = false
  readonly isHashable = false
  readonly isSendable = false
  readonly canImportFromCpp = true
  readonly isReferenceType = false
  readonly requiresSwiftGenericContext = false
  readonly containsSwiftGenerics = false
  readonly needsSwiftConversion = true
  readonly requiresExplicitSwiftTarget = false
  readonly requiredCppHelpers: CppHelper[] = []

  constructor(readonly pointee: SwiftType) {}

  /** Whether the receiver initializes or takes ownership of the pointee. */
  protected abstract readonly isMutable: boolean

  abstract fromSwift(value: string): string
  abstract toSwift(value: string): string

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = this.isMutable ? 'void*' : 'const void*'
        switch (options.context) {
          case 'value':
          case 'type-argument':
            return type
          default:
            // Swift imports signature pointers as non-optional.
            return `${type} NON_NULL`
        }
      }
      case 'swift': {
        const type = this.isMutable
          ? 'UnsafeMutableRawPointer'
          : 'UnsafeRawPointer'
        // Swift drops nullability from C++ template arguments, e.g. std::function parameters.
        return options.context === 'type-argument' ? `${type}!` : type
      }
      default:
        throw new Error(`Swift pointers cannot be represented in ${language}`)
    }
  }

  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(): string {
    // Pointers only carry values through std::function adapters.
    throw new Error('Swift pointers never appear in imported C++ templates')
  }

  // The code that reads or writes the pointee requires its declarations.
  getRequiredImports(): SourceImport[] {
    return []
  }
  getExtraFiles(): SourceFile[] {
    return []
  }

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }
}
