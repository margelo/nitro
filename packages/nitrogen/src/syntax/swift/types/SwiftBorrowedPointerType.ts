import { indent } from '../../../utils.js'
import { SwiftPointerType } from './SwiftPointerType.js'

interface BorrowOptions {
  /** The bridge value to borrow. */
  value: string
  /** The name of the pointer inside `body`. */
  pointer: string
  body: string
  /** The Swift closure's return type. */
  returnType?: string
}

/** Points to an initialized bridge value that the receiver borrows for one call. */
export class SwiftBorrowedPointerType extends SwiftPointerType {
  protected readonly isMutable = false

  /** The value to borrow; the pointer itself only exists inside `borrow()`. */
  fromSwift(value: string): string {
    return this.pointee.fromSwift(value)
  }
  toSwift(pointer: string): string {
    return this.pointee.toSwift(this.load('swift', pointer))
  }

  /** Copies the bridge value behind `pointer`. */
  load(language: 'swift' | 'c++', pointer: string): string {
    const type = this.pointee.getCode(language, { context: 'type-argument' })
    switch (language) {
      case 'swift':
        return `${pointer}.load(as: ${type}.self)`
      case 'c++':
        return `NitroModules::copySwiftValue<${type}>(${pointer})`
    }
  }

  /**
   * Runs `body` with `pointer` borrowing `value`; the pointer must not escape it.
   * Swift returns `body`'s result, C++ returns a statement.
   */
  borrow(
    language: 'swift' | 'c++',
    { value, pointer, body, returnType = 'Void' }: BorrowOptions
  ): string {
    switch (language) {
      case 'swift': {
        const type = this.pointee.getCode(language, {
          context: 'type-argument',
        })
        return `
withUnsafePointer(to: ${value}) { (${pointer}: UnsafePointer<${type}>) -> ${returnType} in
  ${indent(body, '  ')}
}
`.trim()
      }
      case 'c++': {
        const pointerType = this.getCode(language, { context: 'value' })
        return `
NitroModules::withSwiftValue(${value}, [&](${pointerType} ${pointer}) {
  ${indent(body, '  ')}
});
`.trim()
      }
    }
  }

  /**
   * C++ code that returns the Result of `invocation`, which uses `pointer`
   * to borrow `value`. C++ exceptions become the Result's error.
   */
  tryBorrow(value: string, pointer: string, invocation: string): string {
    const pointerType = this.getCode('c++', { context: 'value' })
    return `
borrowSwiftValue(${value}, [&](${pointerType} ${pointer}) {
  return ${indent(invocation, '  ')};
})
`.trim()
  }
}
