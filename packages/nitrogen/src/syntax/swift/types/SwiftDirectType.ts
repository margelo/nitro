import type { CppHelper } from '../../c++/CppHelper.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions, Type, TypeContext } from '../../types/Type.js'
import {
  getClangImporterReferenceName,
  getQualifiedSwiftName,
  type ImportedCxxRecord,
} from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

// TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
// https://github.com/swiftlang/swift/pull/93293.
const ARRAY_BUFFER_RECORD: ImportedCxxRecord = {
  namespaces: ['margelo', 'nitro'],
  swiftName: 'ArrayBuffer',
  identifier: 'ArrayBuffer',
}
const NULL_TYPE_RECORD: ImportedCxxRecord = {
  namespaces: ['margelo', 'nitro'],
  swiftName: 'NullType',
  identifier: 'NullType',
}

/**
 * Imports a C++ type whose Swift representation is identical.
 * For example, `Double` in Swift is `double` in C++ - no conversion needed.
 */
export class SwiftDirectType implements SwiftType {
  constructor(readonly type: Type) {}

  get kind() {
    return this.type.kind
  }
  get isEquatable() {
    return this.type.isEquatable
  }
  get isHashable(): boolean {
    switch (this.type.kind) {
      case 'number':
      case 'boolean':
      case 'int64':
      case 'uint64':
      case 'null':
        return true
      default:
        return false
    }
  }
  get isSendable(): boolean {
    switch (this.type.kind) {
      case 'number':
      case 'boolean':
      case 'int64':
      case 'uint64':
      case 'null':
        return true
      default:
        return false
    }
  }

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }

  get isReferenceType(): boolean {
    return false
  }
  get requiresSwiftGenericContext(): boolean {
    return this.importedCxxRecord != null
  }
  get containsSwiftGenerics(): boolean {
    return false
  }

  get canImportFromCpp(): boolean {
    return true
  }
  readonly requiresExplicitSwiftTarget = false

  get needsSwiftConversion(): boolean {
    return false
  }
  fromSwift(value: string): string {
    return value
  }
  toSwift(value: string): string {
    return value
  }

  getCode(language: Language, options: GetCodeOptions): string {
    return this.type.getCode(language, options)
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  get importedCxxRecord(): ImportedCxxRecord | undefined {
    switch (this.type.kind) {
      case 'array-buffer':
        return ARRAY_BUFFER_RECORD
      case 'null':
        return NULL_TYPE_RECORD
      default:
        return undefined
    }
  }
  getClangImporterName(context: TypeContext): string {
    switch (this.type.kind) {
      case 'number':
        return 'CDouble'
      case 'boolean':
        return 'CBool'
      case 'int64':
        return 'CLongLong'
      case 'uint64':
        return 'CUnsignedLongLong'
      case 'array-buffer': {
        const name = getQualifiedSwiftName(ARRAY_BUFFER_RECORD)
        return getClangImporterReferenceName(name, context)
      }
      case 'null':
        // C++ passes NullType by value.
        return getQualifiedSwiftName(NULL_TYPE_RECORD)
      default:
        throw new Error(`${this.type.kind} is not a direct Swift type`)
    }
  }
  getExtraFiles(): SourceFile[] {
    return this.type.getExtraFiles()
  }
  get requiredCppHelpers(): CppHelper[] {
    return []
  }

  getRequiredImports(language: Language): SourceImport[] {
    return this.type.getRequiredImports(language)
  }
}
