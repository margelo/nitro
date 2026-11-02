import type { KotlinCppConverter } from '../KotlinConverter.js'
import { VoidType } from '../../types/VoidType.js'
import type { KotlinConversion, KotlinType } from './KotlinType.js'

export class KotlinVoidType extends VoidType implements KotlinType {
  readonly jniValueKind = 'primitive'

  getCppConverter(): KotlinCppConverter {
    return { files: [], imports: [] }
  }

  convert(value: string, { in: language }: KotlinConversion): string {
    switch (language) {
      case 'c++':
        return value
      default:
        throw new Error(`Unsupported Kotlin conversion language: ${language}`)
    }
  }
}
