import type { Language } from '../../getPlatformSpecs.js'
import { escapeCppName } from '../helpers.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, NamedType, Type, TypeKind } from './Type.js'

export class NamedWrappingType<T extends Type> implements NamedType {
  readonly type: T
  readonly name: string

  constructor(name: string, type: T) {
    this.name = name
    this.type = type
  }

  get escapedName(): string {
    return escapeCppName(this.name)
  }
  get kind(): TypeKind {
    return this.type.kind
  }
  get isEquatable(): boolean {
    return this.type.isEquatable
  }
  getCode(language: Language, options: GetCodeOptions): string {
    return this.type.getCode(language, options)
  }
  getExtraFiles(): SourceFile[] {
    return this.type.getExtraFiles()
  }
  getRequiredImports(language: Language): SourceImport[] {
    return this.type.getRequiredImports(language)
  }
}
