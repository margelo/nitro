import { NitroConfig } from '../../config/NitroConfig.js'
import type { Language } from '../../getPlatformSpecs.js'
import {
  createCppStruct,
  createCppStructEqualityDefinition,
} from '../c++/CppStruct.js'
import { getForwardDeclaration } from '../c++/getForwardDeclaration.js'
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
  readonly equalityDefinitionFile: SourceFile | undefined

  constructor(structName: string, properties: NamedType[]) {
    this.structName = structName
    this.properties = properties
    this.declarationFile = createCppStruct(structName, properties)
    this.equalityDefinitionFile = properties.every((p) => p.isEquatable)
      ? createCppStructEqualityDefinition(structName)
      : undefined

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

  get canBePassedByReference(): boolean {
    // It's a struct, heavy to copy.
    return true
  }
  get kind(): TypeKind {
    return 'struct'
  }
  get isEquatable(): boolean {
    return this.properties.every((p) => p.isEquatable)
  }

  getCode(language: Language, { fullyQualified }: GetCodeOptions = {}): string {
    switch (language) {
      case 'c++':
        if (fullyQualified) {
          return NitroConfig.current.getCxxNamespace('c++', this.structName)
        } else {
          return this.structName
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
    const files: SourceFile[] = [this.declarationFile, ...referencedTypes]
    if (this.equalityDefinitionFile != null) {
      files.push(this.equalityDefinitionFile)
    }
    return files
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    if (language === 'c++') {
      const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')
      imports.push({
        name: this.declarationFile.name,
        language: this.declarationFile.language,
        forwardDeclaration: getForwardDeclaration(
          'struct',
          this.structName,
          cxxNamespace
        ),
        space: 'user',
      })
    }
    return imports
  }
}
