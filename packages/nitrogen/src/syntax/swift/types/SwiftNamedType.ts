import type { Language } from '../../../getPlatformSpecs.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceImport } from '../../SourceFile.js'
import { NamedWrappingType } from '../../types/NamedWrappingType.js'
import type { Type, TypeContext } from '../../types/Type.js'
import type { ImportedCxxRecord } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'
import { combineSwiftCppConverters, type SwiftCppConverter } from '../SwiftConverter.js'

export class SwiftNamedType extends NamedWrappingType<SwiftType> implements SwiftType {
  getCppConverter(cppType: Type): SwiftCppConverter {
    return combineSwiftCppConverters([this.type.getCppConverter?.(cppType)])
  }

  get isHashable(): boolean {
    return this.type.isHashable
  }

  get isSendable(): boolean {
    return this.type.isSendable
  }

  getProtocolConformances(): ProtocolConformance[] {
    return this.type.getProtocolConformances()
  }

  get isReferenceType(): boolean {
    return this.type.isReferenceType
  }
  get requiresSwiftGenericContext(): boolean {
    return this.type.requiresSwiftGenericContext
  }
  get containsSwiftGenerics(): boolean {
    return this.type.containsSwiftGenerics
  }

  get canImportFromCpp(): boolean {
    return this.type.canImportFromCpp
  }
  get requiresOpaqueCxxBridge(): boolean {
    return this.type.requiresOpaqueCxxBridge ?? false
  }
  get requiresExplicitSwiftTarget(): boolean {
    return this.type.requiresExplicitSwiftTarget
  }
  get needsSwiftConversion(): boolean {
    return this.type.needsSwiftConversion
  }
  fromSwift(value: string): string {
    return this.type.fromSwift(value)
  }
  toSwift(value: string): string {
    return this.type.toSwift(value)
  }
  get requiredCppHelpers(): CppHelper[] {
    return this.type.requiredCppHelpers
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  get importedCxxRecord(): ImportedCxxRecord | undefined {
    return this.type.importedCxxRecord
  }
  getClangImporterName(context: TypeContext): string {
    return this.type.getClangImporterName(context)
  }

  override getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    return this.type.getRequiredImports(language, context)
  }
}
