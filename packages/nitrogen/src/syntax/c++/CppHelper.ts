import type { SourceImport } from '../SourceFile.js'

/** C++ code needed by a generated type. */
export interface CppHelper {
  header: {
    code: string
    requiredImports: SourceImport[]
  }
  implementation?: {
    code: string
    requiredImports: SourceImport[]
  }
}
