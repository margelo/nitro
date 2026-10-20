import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import type {
  JniValueKind,
  KotlinConversion,
  KotlinType,
} from './KotlinType.js'

/**
 * A type without a JNI representation yet, such as `AnyJSON` or tuples.
 * It still contributes imports and nested files, and fails once Kotlin code renders it.
 */
export class KotlinUnsupportedType implements KotlinType {
  readonly needsKotlinConversion = false

  constructor(
    readonly type: Type,
    readonly children: KotlinType[]
  ) {}

  get kind() {
    return this.type.kind
  }
  get isEquatable() {
    return this.type.isEquatable
  }
  get jniValueKind(): JniValueKind {
    return this.throwUnsupported()
  }

  convert(_value: string, _conversion: KotlinConversion): string {
    return this.throwUnsupported()
  }

  getCode(language: Language, options: GetCodeOptions): string {
    // The type reports its own error when Kotlin does not support it.
    return this.type.getCode(language, options)
  }
  getExtraFiles(): SourceFile[] {
    return this.children.flatMap((child) => child.getExtraFiles())
  }
  getRequiredImports(language: Language): SourceImport[] {
    return [
      ...this.type.getRequiredImports(language),
      ...this.children.flatMap((child) => child.getRequiredImports(language)),
    ]
  }

  private throwUnsupported(): never {
    this.type.getCode('kotlin', { context: 'type-argument' })
    throw new Error(`Kotlin interop for ${this.kind} is not yet implemented`)
  }
}
