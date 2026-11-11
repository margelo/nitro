import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'

export type TypeKind =
  | 'array-buffer'
  | 'array'
  | 'int64'
  | 'uint64'
  | 'boolean'
  | 'custom-type'
  | 'enum'
  | 'error'
  | 'function'
  | 'hybrid-object'
  | 'hybrid-object-base'
  | 'map'
  | 'null'
  | 'number'
  | 'optional'
  | 'promise'
  | 'record'
  | 'string'
  | 'struct'
  | 'tuple'
  | 'variant'
  | 'result-wrapper'
  | 'date'
  | 'void'

export interface GetCodeOptions {
  /**
   * Specifies whether the name (e.g. a C++ class name)
   * should use the fully qualified namespace name prefix.
   */
  fullyQualified?: boolean
}

/**
 * Represents a TypeScript Type that can be represented in a native language (C++, Swift, Kotlin)
 */
export interface Type {
  /**
   * Get whether this type can be passed by reference in C++ (`const T&` vs `T`)
   */
  readonly canBePassedByReference: boolean
  /**
   * Get the kind of the type.
   */
  readonly kind: TypeKind
  /**
   * `true` if the type is equatable.
   */
  readonly isEquatable: boolean
  /**
   * Get the native code required to represent this type for the given language (C++, Swift, Kotlin).
   *
   * E.g. for a `number` type, this would return `'double'` in C++.
   *
   * The `options` parameter can specify custom options. Subclasses may have more options.
   */
  getCode(language: Language, options?: GetCodeOptions): string
  /**
   * Get all required extra files that need to be **created** for this type to properly work.
   *
   * E.g. for `type Gender = 'male' | 'female'`, the enum `Gender` needs to be created first (as a separate file).
   */
  getExtraFiles(): SourceFile[]
  /**
   * Get all required extra imports that need to be **imported** for this type to properly work.
   */
  getRequiredImports(language: Language): SourceImport[]
}

export interface NamedType extends Type {
  /**
   * Get the name of the value if it is a member or parameter.
   *
   * E.g. for a class member `double _something`, this returns `'_something'`.
   */
  readonly name: string
  /**
   * Get the name of the value escaped as a valid C++ variable name.
   *
   * E.g. for a class member `double some-value`, this returns `'some_value'`.
   */
  readonly escapedName: string
}
