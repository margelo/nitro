import { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { FunctionType } from '../types/FunctionType.js'
import { SwiftCxxBridgedType } from './SwiftCxxBridgedType.js'

export function createSwiftFunctionBridge(
  functionType: FunctionType
): SourceFile {
  const swiftClassName = functionType.specializationName
  const bridgeNamespace = NitroConfig.current.getSwiftBridgeNamespace('swift')
  const argsTypes = functionType.parameters.map((p) => {
    const bridged = new SwiftCxxBridgedType(p)
    return `${p.escapedName}: ${bridged.getTypeCode('swift')}`
  })
  const returnType = new SwiftCxxBridgedType(functionType.returnType)
  const argsForward = functionType.parameters.map((p) => {
    const bridged = new SwiftCxxBridgedType(p)
    return bridged.parseFromCppToSwift(p.escapedName, 'swift')
  })

  let body: string
  if (functionType.returnType.kind === 'void') {
    body = `
self.closure(${argsForward.join(', ')})
    `.trim()
  } else {
    body = `
let __result: ${functionType.returnType.getCode('swift')} = self.closure(${argsForward.join(', ')})
return ${returnType.parseFromSwiftToCpp('__result', 'swift')}
    `.trim()
  }

  const requiredImports = functionType
    .getRequiredImports('swift')
    .map((i) => `import ${i.name}`)
  requiredImports.push('import NitroModules')
  const imports = requiredImports.filter(isNotDuplicate)

  const code = `
${createFileMetadataString(`${swiftClassName}.swift`)}

${imports.join('\n')}

/**
 * Wraps a Swift \`${functionType.getCode('swift')}\` as a class.
 * This class can be used from C++, e.g. to wrap the Swift closure as a \`std::function\`.
 */
public final class ${swiftClassName} {
  public typealias bridge = ${bridgeNamespace}

  private let closure: ${functionType.getCode('swift')}

  public init(_ closure: @escaping ${functionType.getCode('swift')}) {
    self.closure = closure
  }

  @inline(__always)
  public func call(${argsTypes.join(', ')}) -> ${returnType.getTypeCode('swift')} {
    ${indent(body, '    ')}
  }

  /**
   * Casts this instance to a retained unsafe raw pointer.
   * This acquires one additional strong reference on the object!
   */
  @inline(__always)
  public func toUnsafe() -> UnsafeMutableRawPointer {
    return Unmanaged.passRetained(self).toOpaque()
  }

  /**
   * Casts an unsafe pointer to a \`${swiftClassName}\`.
   * The pointer has to be a retained opaque \`Unmanaged<${swiftClassName}>\`.
   * This removes one strong reference from the object!
   */
  @inline(__always)
  public static func fromUnsafe(_ pointer: UnsafeMutableRawPointer) -> ${swiftClassName} {
    return Unmanaged<${swiftClassName}>.fromOpaque(pointer).takeRetainedValue()
  }
}
  `.trim()

  return {
    content: code,
    language: 'swift',
    name: `${swiftClassName}.swift`,
    platform: 'ios',
    subdirectory: [],
  }
}
