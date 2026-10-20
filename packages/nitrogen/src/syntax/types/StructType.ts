import { NitroConfig } from '../../config/NitroConfig.js'
import type { Language } from '../../getPlatformSpecs.js'
import { createCppStruct } from '../c++/CppStruct.js'
import {
  type FileWithReferencedTypes,
  type SourceFile,
  type SourceImport,
} from '../SourceFile.js'
import type { GetCodeOptions, NamedType, Type, TypeKind } from './Type.js'

export class StructType implements Type {
  readonly structName: string
  readonly properties: NamedType[]
  readonly declarationFile: FileWithReferencedTypes
  readonly implementationFile: SourceFile

  constructor(structName: string, properties: NamedType[]) {
    this.structName = structName
    this.properties = properties
    const [declarationFile, implementationFile] = createCppStruct(
      structName,
      properties
    )
    this.declarationFile = declarationFile
    this.implementationFile = implementationFile

    if (this.structName.startsWith('__')) {
      throw new Error(
        `Struct name cannot start with two underscores (__) as this is reserved syntax for Nitrogen! (In ${this.structName})`
      )
    }
    if (this.properties.length === 0) {
      throw new Error(
        `Empty structs are not supported in Nitrogen! Add at least one property to ${this.structName}.`
      )
    }
  }

  get kind(): TypeKind {
    return 'struct'
  }
  get isEquatable(): boolean {
    return this.properties.every((p) => p.isEquatable)
  }

  getCode(
    language: Language,
    { fullyQualified, context }: GetCodeOptions
  ): string {
    switch (language) {
      case 'c++': {
        let type = this.structName
        if (fullyQualified) {
          type = NitroConfig.current.getCxxNamespace('c++', this.structName)
        }
        return context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return this.structName
      case 'kotlin':
        return this.structName
      default:
        throw new Error(
          `Language ${language} is not yet supported for StructType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    const referencedTypes = this.declarationFile.referencedTypes.flatMap((r) =>
      r.getExtraFiles()
    )
    return [this.declarationFile, this.implementationFile, ...referencedTypes]
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: NitroConfig.current.getCxxHeader(
            this.declarationFile.name
          ),
        })
        break
    }
    return imports
  }
}
