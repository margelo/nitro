import { indent } from '../../../utils.js'
import { SwiftBorrowedPointerType, type BorrowOptions } from './SwiftBorrowedPointerType.js'

/**
 * Borrows an imported C++ value without requiring its exported Swift metadata.
 * TODO: Remove once our minimum Xcode includes https://github.com/swiftlang/swift/pull/93321,
 * which fixes https://github.com/swiftlang/swift/issues/93318.
 */
export class SwiftCxxBorrowedPointerType extends SwiftBorrowedPointerType {
  override load(language: 'swift' | 'c++', pointer: string): string {
    switch (language) {
      case 'swift':
        return super.load(language, pointer)
      case 'c++': {
        const type = this.pointee.getCode('c++', { context: 'type-argument' })
        return `*static_cast<const ${type}*>(${pointer})`
      }
    }
  }

  override borrow(language: 'swift' | 'c++', { value, pointer, body, returnType = 'Void' }: BorrowOptions): string {
    switch (language) {
      case 'swift':
        return super.borrow(language, { value, pointer, body, returnType })
      case 'c++': {
        const pointerType = this.getCode('c++', { context: 'value' })
        return `
([&](${pointerType} ${pointer}) {
  ${indent(body, '  ')}
})(std::addressof(${value}));
`.trim()
      }
    }
  }

  override tryBorrow(value: string, pointer: string, invocation: string): string {
    const pointerType = this.getCode('c++', { context: 'value' })
    return `
([&](${pointerType} ${pointer}) {
  return ${indent(invocation, '  ')};
})(std::addressof(${value}))
`.trim()
  }
}
