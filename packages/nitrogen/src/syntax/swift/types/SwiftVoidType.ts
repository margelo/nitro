import type { CppHelper } from '../../c++/CppHelper.js'
import { VoidType } from '../../types/VoidType.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

export class SwiftVoidType extends VoidType implements SwiftType {
  override get isEquatable(): boolean {
    return false
  }

  readonly isHashable = false
  readonly isSendable = true
  readonly canImportFromCpp = true
  readonly isReferenceType = false
  readonly requiresSwiftGenericContext = false
  readonly containsSwiftGenerics = false
  readonly needsSwiftConversion = false
  readonly requiresExplicitSwiftTarget = false

  fromSwift(value: string): string {
    return value
  }
  toSwift(value: string): string {
    return value
  }

  get requiredCppHelpers(): CppHelper[] {
    return []
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(): string {
    return 'Void'
  }

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }
}
