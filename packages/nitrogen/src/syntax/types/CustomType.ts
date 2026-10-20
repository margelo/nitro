import type { CustomTypeConfig } from 'nitro-core'
import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { Type, TypeKind } from './Type.js'

export class CustomType implements Type {
  typeConfig: CustomTypeConfig
  typeName: string

  constructor(typeName: string, typeConfig: CustomTypeConfig) {
    this.typeName = typeName
    this.typeConfig = typeConfig
  }

  get canBePassedByReference() {
    return this.typeConfig.canBePassedByReference ?? false
  }

  get kind(): TypeKind {
    return 'custom-type'
  }
  get isEquatable(): boolean {
    return false
  }

  getCode(language: Language): string {
    switch (language) {
      case 'c++':
        return this.typeName
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
    if (language === 'c++') {
      imports.push({
        name: this.typeConfig.include,
        language: 'c++',
        space: 'user',
      })
    }
    return imports
  }
}
