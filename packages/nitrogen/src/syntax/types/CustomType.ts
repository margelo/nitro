import type { CustomTypeConfig } from 'nitro-core'
import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class CustomType implements Type {
  typeConfig: CustomTypeConfig
  typeName: string

  constructor(typeName: string, typeConfig: CustomTypeConfig) {
    this.typeName = typeName
    this.typeConfig = typeConfig
  }

  get kind(): TypeKind {
    return 'custom-type'
  }
  get isEquatable(): boolean {
    return false
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return options.context === 'parameter' &&
          this.typeConfig.canBePassedByReference
          ? `const ${this.typeName}&`
          : this.typeName
      default:
        throw new Error(
          `Language ${language} is not yet supported for CustomType "${this.typeName}"!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return []
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { name: this.typeConfig.include, space: 'user' },
        })
        break
    }
    return imports
  }
}
