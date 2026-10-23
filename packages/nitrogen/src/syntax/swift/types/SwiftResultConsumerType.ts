import type { Language } from '../../../getPlatformSpecs.js'
import { indent } from '../../../utils.js'
import type { SourceImport } from '../../SourceFile.js'
import { SwiftPointerType } from './SwiftPointerType.js'

interface ReceiveOptions {
  /** The name of the consumer pointer. */
  consumer: string
  /** The Swift call that returns the status and lends its value to the consumer. */
  invocation: string
}

interface ConsumeOptions {
  /** The name of the consumer pointer. */
  consumer: string
  /** The bridge value to lend. */
  value: string
}

/**
 * Points to a C++ SwiftResultConsumer. Swift lends a successful return value to it,
 * so the value does not cross the boundary in a boxed swift::Optional.
 * TODO: Pass margelo.nitro.SwiftResultConsumer directly once our minimum Xcode includes
 * https://github.com/swiftlang/swift/pull/93321, which fixes https://github.com/swiftlang/swift/issues/93318.
 */
export class SwiftResultConsumerType extends SwiftPointerType {
  protected readonly isMutable = false

  /** The value to lend; see `consume()`. */
  fromSwift(value: string): string {
    return this.pointee.fromSwift(value)
  }
  toSwift(value: string): string {
    return this.pointee.toSwift(value)
  }

  /** C++ code that returns the Result of `invocation`, holding the value Swift lent to `consumer`. */
  receive({ consumer, invocation }: ReceiveOptions): string {
    const type = this.pointee.getCode('c++', { context: 'type-argument' })
    const pointerType = this.getCode('c++', { context: 'value' })
    return `
receiveSwiftResult<${type}>([&](${pointerType} ${consumer}) {
  return ${indent(invocation, '  ')};
})
`.trim()
  }

  /** Swift code that lends `value` to `consumer` for the duration of the call. */
  consume({ consumer, value }: ConsumeOptions): string {
    return `
withUnsafePointer(to: ${value}) { pointer in
  margelo.nitro.SwiftResultConsumer.consume(${consumer}, UnsafeRawPointer(pointer))
}
`.trim()
  }

  /** Swift calls the consumer through its C++ declaration. */
  override getRequiredImports(language?: Language): SourceImport[] {
    switch (language) {
      case 'swift':
        return [{ language: language, name: 'NitroModulesAppleCxx', access: 'internal' }]
      default:
        return []
    }
  }
}
