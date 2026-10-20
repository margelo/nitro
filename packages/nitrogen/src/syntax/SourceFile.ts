import type { Language, Platform } from '../getPlatformSpecs.js'
import type { Type } from './types/Type.js'

export type CxxHeaderVisibility = 'public' | 'private'

/**
 * Represents a file with source code, in a specific programming language.
 */
export interface SourceFile {
  /**
   * The name of the file with extension (e.g. `Image.hpp`)
   */
  name: string
  /**
   * The subdirectory/subdirectories of the file, or empty (`[]`) if none.
   */
  subdirectory: string[]
  /**
   * The full content of the file.
   */
  content: string
  /**
   * The language the {@linkcode content} is written in (e.g. `c++`)
   */
  language: Language
  /**
   * The platform this file can be used on or is created for. (e.g. `ios`)
   */
  platform: Platform | 'shared'
  /**
   * The include directory for a C++ header. Shared headers default to public;
   * platform bridge headers default to private.
   */
  headerVisibility?: CxxHeaderVisibility
}

/**
 * Represents a {@linkcode SourceFile} that also references other types.
 */
export interface FileWithReferencedTypes extends SourceFile {
  /**
   * All external types this {@linkcode SourceFile} references,
   * either as return types, parameter types, or member types.
   */
  referencedTypes: Type[]
}

export type SourceImport<L extends Language = Language> = L extends 'c++'
  ? {
      language: L
      /** Code required wherever this type is declared. */
      declaration:
        | { forwardDeclaration: string }
        | { name: string; space: 'user' | 'system' }
      /**
       * A definition needed by implementations using this type.
       * Defaults to the declaration if it is an include.
       */
      implementation?: { name: string; space: 'user' | 'system' }
    }
  : L extends 'swift'
    ? {
        language: L
        name: string
        /** The widest declaration visibility that may reference this module. */
        access: 'private' | 'internal' | 'public'
      }
    : { language: L; name: string }

type GroupedFiles = Record<SourceFile['platform'], SourceFile[]>

export function groupByPlatform(files: SourceFile[]): GroupedFiles {
  const result: GroupedFiles = { shared: [], ios: [], android: [] }
  for (const file of files) {
    result[file.platform].push(file)
  }
  return result
}
