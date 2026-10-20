import type { SourceImport } from '../SourceFile.js'

/** A protocol declared on a generated Swift type. */
export interface ProtocolConformance {
  name: string
  requiredImport?: SourceImport<'swift'>
}
