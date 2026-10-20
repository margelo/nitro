import { indent } from '../../../utils.js'
import { SwiftPointerType } from './SwiftPointerType.js'

interface AllocateOptions {
  /** The name of the temporary storage. */
  storage: string
  /** Code that initializes the storage through the given pointer. */
  body: (pointer: string) => string
  /** The Swift closure's return type. */
  returnType?: string
}

/** Points to uninitialized storage that the receiver initializes with one bridge value. */
export class SwiftOutPointerType extends SwiftPointerType {
  protected readonly isMutable = true

  /** The value to store; see `initialize()`. */
  fromSwift(value: string): string {
    return this.pointee.fromSwift(value)
  }
  /** Converts the value that `allocate()` moves out of its storage. */
  toSwift(value: string): string {
    return this.pointee.toSwift(value)
  }

  /** Initializes the storage behind `pointer` with a bridge `value`. */
  initialize(
    language: 'swift' | 'c++',
    pointer: string,
    value: string
  ): string {
    const type = this.pointee.getCode(language, { context: 'type-argument' })
    switch (language) {
      case 'swift':
        return `${pointer}.assumingMemoryBound(to: ${type}.self).initialize(to: ${value})`
      case 'c++':
        return `NitroModules::initializeSwiftValue(${pointer}, ${value})`
    }
  }

  /**
   * Allocates temporary storage, runs `body` to initialize it, and returns
   * the stored value. Swift converts it with `toSwift()`.
   */
  allocate(
    language: 'swift' | 'c++',
    { storage, body, returnType = 'Void' }: AllocateOptions
  ): string {
    const type = this.pointee.getCode(language, { context: 'type-argument' })
    switch (language) {
      case 'swift': {
        const initializeCode = body(`${storage}.baseAddress!`)
        return `
withUnsafeTemporaryAllocation(of: ${type}.self, capacity: 1) { (${storage}: UnsafeMutableBufferPointer<${type}>) -> ${returnType} in
  ${indent(initializeCode, '  ')}
  let value = ${storage}.baseAddress!.move()
  return ${this.toSwift('value')}
}
`.trim()
      }
      case 'c++': {
        const pointerType = this.getCode(language, { context: 'value' })
        return `
NitroModules::makeSwiftValue<${type}>([&](${pointerType} ${storage}) {
  ${indent(body(storage), '  ')}
})
`.trim()
      }
    }
  }

  /**
   * C++ code that returns the Result of `invocation`, which initializes
   * temporary `storage`. On success, the Result holds the stored value.
   */
  tryAllocate(storage: string, invocation: string): string {
    const type = this.pointee.getCode('c++', { context: 'type-argument' })
    const pointerType = this.getCode('c++', { context: 'value' })
    return `
withSwiftResult<${type}>([&](${pointerType} ${storage}) {
  return ${indent(invocation, '  ')};
})
`.trim()
  }
}
