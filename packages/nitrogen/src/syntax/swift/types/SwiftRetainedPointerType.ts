import { SwiftPointerType } from './SwiftPointerType.js'

/**
 * Points to a Swift class instance and transfers one retain to the receiver.
 * Both languages use the class's `toUnsafe()` and `fromUnsafe(pointer:)`.
 */
export class SwiftRetainedPointerType extends SwiftPointerType {
  protected readonly isMutable = true

  fromSwift(value: string): string {
    return this.retain('swift', this.pointee.fromSwift(value))
  }
  toSwift(pointer: string): string {
    return this.pointee.toSwift(this.take('swift', pointer))
  }

  /** Retains a bridge `value` and returns its opaque pointer. */
  retain(_language: 'swift' | 'c++', value: string): string {
    return `${value}.toUnsafe()`
  }

  /** Takes over the retain behind `pointer` and returns its bridge value. */
  take(language: 'swift' | 'c++', pointer: string): string {
    const type = this.pointee.getCode(language, { context: 'value' })
    switch (language) {
      case 'swift':
        return `${type}.fromUnsafe(pointer: ${pointer})`
      case 'c++':
        return `${type}::fromUnsafe(${pointer})`
    }
  }
}
