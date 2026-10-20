import type { GetCodeOptions, TypeContext } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { ErrorType } from '../../types/ErrorType.js'
import {
  getClangImporterReferenceName,
  getQualifiedSwiftName,
  type ImportedCxxRecord,
} from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

export class SwiftErrorType extends ErrorType implements SwiftType {
  override get isEquatable(): boolean {
    // The public API uses `any Error`, even though std::exception_ptr is comparable.
    return false
  }

  readonly isHashable = false
  readonly isSendable = true

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }

  get isReferenceType(): boolean {
    return false
  }
  readonly requiresSwiftGenericContext = true
  get containsSwiftGenerics(): boolean {
    return false
  }

  readonly canImportFromCpp = true

  readonly requiresExplicitSwiftTarget = false

  get needsSwiftConversion(): boolean {
    return true
  }
  fromSwift(value: string): string {
    return `${value}.toCpp()`
  }
  toSwift(value: string): string {
    return `RuntimeError.from(cppError: ${value})`
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'swift':
        return 'std.exception_ptr'
      default:
        return super.getCode(language, options)
    }
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  readonly importedCxxRecord: ImportedCxxRecord = {
    namespaces: ['std'],
    swiftName: 'exception_ptr',
    identifier: 'std__exception_ptr',
  }
  getClangImporterName(context: TypeContext): string {
    const name = getQualifiedSwiftName(this.importedCxxRecord)
    return getClangImporterReferenceName(name, context)
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = super.getRequiredImports(language)
    switch (language) {
      case 'swift':
        imports.push({ language, name: 'CxxStdlib', access: 'public' })
        break
    }
    return imports
  }

  get requiredCppHelpers(): CppHelper[] {
    return []
  }
}
