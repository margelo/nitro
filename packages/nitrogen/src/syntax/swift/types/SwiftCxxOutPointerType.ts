import { indent } from '../../../utils.js'
import { SwiftOutPointerType, type AllocateOptions } from './SwiftOutPointerType.js'

/**
 * Initializes imported C++ storage without requiring exported Swift metadata.
 * TODO: Remove once our minimum Xcode includes https://github.com/swiftlang/swift/pull/93321,
 * which fixes https://github.com/swiftlang/swift/issues/93318.
 */
export class SwiftCxxOutPointerType extends SwiftOutPointerType {
  override initialize(language: 'swift' | 'c++', pointer: string, value: string): string {
    const type = this.pointee.getCode(language, { context: 'type-argument' })
    switch (language) {
      case 'swift':
        return `${pointer}.initializeMemory(as: ${type}.self, repeating: ${value}, count: 1)`
      case 'c++':
        return `std::construct_at(static_cast<${type}*>(${pointer}), ${value})`
    }
  }

  override tryAllocate(storage: string, invocation: string): string {
    const type = this.pointee.getCode('c++', { context: 'type-argument' })
    const pointerType = this.getCode('c++', { context: 'value' })
    return `
withCxxResult<${type}>([&](${pointerType} ${storage}) {
  return ${indent(invocation, '  ')};
})
`.trim()
  }

  override allocate(language: 'swift' | 'c++', { storage, body, returnType = 'Void' }: AllocateOptions): string {
    switch (language) {
      case 'swift':
        return super.allocate(language, { storage, body, returnType })
      case 'c++': {
        const type = this.pointee.getCode('c++', { context: 'type-argument' })
        const pointerType = this.getCode('c++', { context: 'value' })
        return `
makeCxxValue<${type}>([&](${pointerType} ${storage}) {
  ${indent(body(storage), '  ')}
})
`.trim()
      }
    }
  }
}
