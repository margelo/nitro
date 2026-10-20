import type { SourceImport } from '../../SourceFile.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { Type, TypeContext } from '../../types/Type.js'
import type { ImportedCxxRecord } from '../ImportedCxxRecord.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'
import type { SwiftCppConverter } from '../SwiftConverter.js'

/** A concrete Swift representation used by C++ JSI converters. */
export interface SwiftType extends Type {
  /** Whether the public Swift API type conforms to Equatable, before bridge conversion. */
  readonly isEquatable: boolean
  /** Whether the public Swift API type conforms to Hashable, before bridge conversion. */
  readonly isHashable: boolean
  /** Whether the public Swift API type conforms to Sendable, before bridge conversion. */
  readonly isSendable: boolean
  /**
   * Protocols to declare on this type's generated Swift declaration.
   * Existing types such as String return [], even when they satisfy the capability flags above.
   * Imported bridge specializations have their own extension conformances.
   */
  getProtocolConformances(): ProtocolConformance[]
  readonly requiredCppHelpers: CppHelper[]
  /** Native converters requested by a C++ API consuming this Swift representation. */
  getCppConverter?(cppType: Type): SwiftCppConverter
  /** Header imports may forward-declare types; implementations need their definitions. */
  getRequiredImports(language: Language, context?: 'declaration' | 'implementation'): SourceImport[]
  /** Whether Swift can import this C++ representation directly. */
  readonly canImportFromCpp: boolean
  // TODO: Remove once our minimum Xcode includes https://github.com/swiftlang/swift/pull/93321,
  // which fixes https://github.com/swiftlang/swift/issues/93318.
  /**
   * Whether exported Swift signatures pass this imported C++ value through native
   * C++ storage instead of naming its record. Two generated -Swift.h headers that
   * name the same record both specialize its generic traits, so C++ including both fails.
   */
  readonly requiresOpaqueCxxBridge?: boolean
  /** Whether this Swift value uses the retained class-reference bridge. */
  readonly isReferenceType: boolean
  /**
   * Whether this representation contains `swift::Optional` or `swift::Array`, including in wrappers and nested signatures.
   * Bridge headers only forward-declare them, so C++ that converts such values must be compiled after the generated -Swift.h.
   */
  readonly containsSwiftGenerics: boolean
  /** Whether generic eligibility requires declarations from this module's -Swift.h. */
  readonly requiresSwiftGenericContext: boolean
  /** Whether the public Swift API needs conversion to this representation. */
  readonly needsSwiftConversion: boolean
  /**
   * Whether the native C++ type can map to multiple Swift representations,
   * requiring an explicit Swift target in its SwiftConverter specialization.
   */
  readonly requiresExplicitSwiftTarget: boolean
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  /**
   * The C++ record Swift imports for this type, if Swift does not define it.
   * C++ gets its type metadata from Swift when it stores it in a `swift::Optional`,
   * `swift::Array` or dictionary slot.
   */
  readonly importedCxxRecord?: ImportedCxxRecord
  /**
   * How Swift names this C++ type in imported class template specializations,
   * e.g. `CDouble` in `Callback<((CDouble) -> Void)>`.
   */
  getClangImporterName(context: TypeContext): string
  fromSwift(value: string): string
  toSwift(value: string): string
}
