import { NamedWrappingType } from '../../types/NamedWrappingType.js'
import type {
  JniValueKind,
  KotlinConversion,
  KotlinType,
} from './KotlinType.js'

export class KotlinNamedType
  extends NamedWrappingType<KotlinType>
  implements KotlinType
{
  get jniValueKind(): JniValueKind {
    return this.type.jniValueKind
  }
  get fromCppReturnType(): string | undefined {
    return this.type.fromCppReturnType
  }
  get needsKotlinConversion(): boolean {
    return this.type.needsKotlinConversion
  }

  convert(value: string, conversion: KotlinConversion): string {
    return this.type.convert(value, conversion)
  }
}
