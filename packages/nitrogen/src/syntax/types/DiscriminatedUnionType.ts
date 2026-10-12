import { NitroConfig } from '../../config/NitroConfig.js'
import type { Language } from '../../getPlatformSpecs.js'
import { createCppDiscriminatedUnion } from '../c++/CppDiscriminatedUnion.js'
import { getForwardDeclaration } from '../c++/getForwardDeclaration.js'
import { isNotDuplicate } from '../helpers.js'
import type {
  FileWithReferencedTypes,
  SourceFile,
  SourceImport,
} from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'
import type { StructType } from './StructType.js'

export interface DiscriminatedVariant {
  /** The string literal value of the discriminant property (e.g. 'truck') */
  discriminantValue: string
  type: StructType
}

export class DiscriminatedUnionType implements Type {
  readonly unionName: string
  /** The property key that discriminates the union (e.g. 'kind') */
  readonly discriminantKey: string
  readonly variants: DiscriminatedVariant[]
  readonly declarationFile: FileWithReferencedTypes

  constructor(
    unionName: string,
    discriminantKey: string,
    variants: DiscriminatedVariant[]
  ) {
    this.unionName = unionName
    this.discriminantKey = discriminantKey
    this.variants = variants
    this.declarationFile = createCppDiscriminatedUnion(this)
  }

  get canBePassedByReference(): boolean {
    // std::variant is heavy to copy
    return true
  }

  get kind(): TypeKind {
    return 'discriminated-union'
  }

  get isEquatable(): boolean {
    return this.variants.every((v) => v.type.isEquatable)
  }

  /** C++ type is std::variant<A, B, ...> — same underlying representation as VariantType */
  getCode(language: Language, options?: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const types = this.variants
          .map((v) => v.type.getCode('c++', options))
          .filter(isNotDuplicate)
        return `std::variant<${types.join(', ')}>`
      }
      case 'swift':
      case 'kotlin':
        return this.unionName
      default:
        throw new Error(
          `Language ${language} is not yet supported for DiscriminatedUnionType!`
        )
    }
  }

  getExtraFiles(): SourceFile[] {
    const structFiles = this.variants.flatMap((v) => v.type.getExtraFiles())
    return [this.declarationFile, ...structFiles]
  }

  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = this.variants.flatMap((v) =>
      v.type.getRequiredImports(language)
    )
    if (language === 'c++') {
      const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')
      imports.push(
        {
          name: this.declarationFile.name,
          language: 'c++',
          forwardDeclaration: getForwardDeclaration(
            'struct',
            this.unionName,
            cxxNamespace
          ),
          space: 'user',
        },
        {
          language: 'c++',
          name: 'variant',
          space: 'system',
        }
      )
    }
    return imports
  }
}
