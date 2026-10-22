import { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftCallbackType } from './types/SwiftCallbackType.js'
import { getImportsCode } from '../getImportCode.js'
import { getSwiftImports } from './getSwiftImports.js'
import { createSwiftCatchBody, createSwiftResultBody, getSwiftBridgeParameters, type SwiftBridgeParameter } from './SwiftMethodHelpers.js'
import { SwiftBorrowedPointerType } from './types/SwiftBorrowedPointerType.js'
import { SwiftOutPointerType } from './types/SwiftOutPointerType.js'

interface SwiftCallbackArgument {
  parameter: SwiftBridgeParameter
  argument: string
}

function getSwiftCallbackArguments(type: SwiftCallbackType): SwiftCallbackArgument[] {
  const adapterParameters = type.adapterParameters
  return adapterParameters.map((parameter, index) => {
    let argument = `arguments.${index}`
    if (adapterParameters.length === 1) argument = 'arguments'
    return {
      parameter: parameter,
      argument: parameter.type.fromSwift(argument),
    }
  })
}

function getSwiftCallArguments(swiftArguments: SwiftCallbackArgument[]): string[] {
  return swiftArguments.map(({ parameter, argument }) => {
    if (parameter.type instanceof SwiftBorrowedPointerType) return parameter.name
    return argument
  })
}

interface BorrowSwiftArgumentsOptions {
  swiftArguments: SwiftCallbackArgument[]
  code: string
  returnType: string
  isThrowing: boolean
}

/** Each pointer borrows its argument for this invocation only. */
function borrowSwiftArguments({ swiftArguments, code, returnType, isThrowing }: BorrowSwiftArgumentsOptions): string {
  const tryKeyword = isThrowing ? 'try ' : ''
  let borrowedCode = code
  for (const { parameter, argument } of swiftArguments.toReversed()) {
    if (!(parameter.type instanceof SwiftBorrowedPointerType)) continue
    const scopeCode = parameter.type.borrow('swift', {
      value: argument,
      pointer: parameter.name,
      body: borrowedCode,
      returnType: returnType,
    })
    borrowedCode = `return ${tryKeyword}${scopeCode}`
  }
  return borrowedCode
}

interface SwiftSyncCallOptions {
  type: SwiftCallbackType
  bridgeFunction: string
}

/** Calls a C++ callback synchronously and rethrows its error in Swift. */
function createSwiftSyncCallCode({ type, bridgeFunction }: SwiftSyncCallOptions): string {
  const isVoid = type.returnType.kind === 'void'
  const adapterReturnType = type.adapterReturnType
  const swiftArguments = getSwiftCallbackArguments(type)
  const adapterArguments = ['self', ...getSwiftCallArguments(swiftArguments)]
  const cppToSwiftErrorCode = `
if __result.hasError() {
  throw RuntimeError.from(cppError: __result.error())
}
`.trim()
  let swiftToCppCallSyncCode: string
  if (adapterReturnType instanceof SwiftOutPointerType) {
    const getSwiftToCppStorageCode = (pointer: string): string => {
      const callSyncArguments = [...adapterArguments, pointer]
      return `
let __result = bridge.${bridgeFunction}(${callSyncArguments.join(', ')})
${cppToSwiftErrorCode}
`.trim()
    }
    const allocateCode = adapterReturnType.allocate('swift', {
      storage: 'result',
      returnType: 'Return',
      body: getSwiftToCppStorageCode,
    })
    swiftToCppCallSyncCode = `
return try ${allocateCode}
`.trim()
  } else {
    let cppToSwiftReturnCode = ''
    if (!isVoid) {
      const swiftResult = adapterReturnType.toSwift('__result.copyValue()')
      cppToSwiftReturnCode = `
return ${swiftResult}
`.trim()
    }
    swiftToCppCallSyncCode = `
let __result = bridge.${bridgeFunction}(${adapterArguments.join(', ')})
${cppToSwiftErrorCode}
${cppToSwiftReturnCode}
`.trim()
  }
  return borrowSwiftArguments({
    swiftArguments: swiftArguments,
    code: swiftToCppCallSyncCode,
    returnType: 'Return',
    isThrowing: true,
  })
}

export function createSwiftCallbackBridge(type: SwiftCallbackType): SourceFile[] {
  const swiftClassName = type.specializationName
  const bridgeNamespace = NitroConfig.current.getSwiftBridgeNamespace('swift')
  const swiftParameterTypes = type.type.parameters.map((parameter) => parameter.getCode('swift', { context: 'type-argument' }))
  const swiftReturnType = type.type.returnType.getCode('swift', {
    context: 'return',
  })
  const swiftAsyncResultType = type.asyncResult.getCode('swift', {
    context: 'return',
  })
  const swiftResultType = `bridge.${type.syncResult.specializationName}`
  const isVoid = type.returnType.kind === 'void'
  const needsAdapter = type.needsAdapter
  const adapterParameters = type.adapterParameters
  const adapterReturnType = type.adapterReturnType
  const swiftArguments = getSwiftCallbackArguments(type)
  const swiftCallArguments = getSwiftCallArguments(swiftArguments)
  const adapterArguments = ['self', ...swiftCallArguments]
  const swiftToCppCallSyncCode = createSwiftSyncCallCode({
    type: type,
    bridgeFunction: `callSync_${swiftClassName}`,
  })

  let swiftToCppCallAsyncCode: string
  let swiftToCppCallAndForgetCode: string
  let callingConvention: string
  if (needsAdapter) {
    // Capturing self in pointer closures around C++ adapters consumes it in
    // Swift's ownership model.
    callingConvention = ''
    swiftToCppCallAsyncCode = `
return bridge.callAsync_${swiftClassName}(${adapterArguments.join(', ')})
`.trim()
    swiftToCppCallAndForgetCode = `
bridge.callAndForget_${swiftClassName}(${adapterArguments.join(', ')})
`.trim()
  } else {
    callingConvention = 'borrowing '
    swiftToCppCallAsyncCode = `
return __callAsync(${swiftCallArguments.join(', ')})
`.trim()
    swiftToCppCallAndForgetCode = `
__callAndForget(${swiftCallArguments.join(', ')})
`.trim()
  }
  swiftToCppCallAsyncCode = borrowSwiftArguments({
    swiftArguments: swiftArguments,
    code: swiftToCppCallAsyncCode,
    returnType: 'AsyncResult',
    isThrowing: false,
  })
  swiftToCppCallAndForgetCode = borrowSwiftArguments({
    swiftArguments: swiftArguments,
    code: swiftToCppCallAndForgetCode,
    returnType: 'Void',
    isThrowing: false,
  })

  const closureParameters = getSwiftBridgeParameters(adapterParameters, adapterReturnType)
  const closureParameterDeclarations = closureParameters.map(
    ({ name, type: parameterType }) => `${name}: ${parameterType.getCode('swift', { context: 'type-argument' })}`
  )
  const swiftClosureArguments = adapterParameters.map(({ name, type: parameterType }) => parameterType.toSwift(name))
  const cppToSwiftClosureCode = createSwiftResultBody({
    invocation: `try closure(${swiftClosureArguments.join(', ')})`,
    returnType: adapterReturnType,
    resultType: swiftResultType,
    returnsVoid: isVoid,
  })
  const cppToSwiftClosureBody = createSwiftCatchBody(cppToSwiftClosureCode, swiftResultType)
  const swiftToCppInitializerCode = `
self = bridge.create_${swiftClassName}(.init { (${closureParameterDeclarations.join(', ')}) -> ${swiftResultType} in
  ${indent(cppToSwiftClosureBody, '  ')}
})
`.trim()

  const swiftClosureParameterNames = type.parameters.map((parameter) => parameter.escapedName)
  const swiftClosureParameterDeclarations = type.type.parameters.map((parameter, index) => {
    const swiftParameterType = parameter.getCode('swift', {
      context: 'type-argument',
    })
    return `param${index}: ${swiftParameterType}`
  })
  const publicSwiftTypes = [type.type, type, type.asyncResult]
  const wrappedSwiftTypes = [type.returnType, ...type.parameters, type.syncResult]
  const swiftImports = getImportsCode([
    { language: 'swift', name: 'NitroModules', access: 'public' },
    { language: 'swift', name: 'CxxStdlib', access: 'internal' },
    ...getSwiftImports(publicSwiftTypes, 'public'),
    ...getSwiftImports(wrappedSwiftTypes, 'internal'),
  ])
  const swiftCode = `
${createFileMetadataString(`${swiftClassName}.swift`)}

${swiftImports}

public typealias ${swiftClassName} = ${bridgeNamespace}.${swiftClassName}

extension ${swiftClassName} {
  public typealias Arguments = (${swiftParameterTypes.join(', ')})
  public typealias Return = ${swiftReturnType}
  public typealias AsyncResult = ${swiftAsyncResultType}
  private typealias bridge = ${bridgeNamespace}

  public ${callingConvention}func callSync(_ arguments: Arguments) throws -> Return {
    ${indent(swiftToCppCallSyncCode, '    ')}
  }
  public ${callingConvention}func callAsync(_ arguments: Arguments) -> AsyncResult {
    ${indent(swiftToCppCallAsyncCode, '    ')}
  }
  public ${callingConvention}func callAndForget(_ arguments: Arguments) {
    ${indent(swiftToCppCallAndForgetCode, '    ')}
  }
  public init(_ closure: @escaping @Sendable (${swiftParameterTypes.join(', ')}) throws -> Return) {
    ${indent(swiftToCppInitializerCode, '    ')}
  }
}

extension Callback<(${swiftParameterTypes.join(', ')}), ${swiftReturnType}> where Self == ${swiftClassName} {
  /// Creates a native callback from an escaping Swift closure.
  public static func native(_ closure: @escaping @Sendable (${swiftParameterTypes.join(', ')}) throws -> ${swiftReturnType}) -> Self {
    return Self(closure)
  }
}

extension Callback<(${swiftParameterTypes.join(', ')}), ${swiftReturnType}> {
  func toCpp() -> ${swiftClassName} {
    if let value = self as? ${swiftClassName} {
      return value
    }
    return ${swiftClassName} { (${swiftClosureParameterDeclarations.join(', ')}) -> ${swiftReturnType} in
      try self.callSync((${swiftClosureParameterNames.join(', ')}))
    }
  }
}
`.trim()
  const sourceFiles: SourceFile[] = [
    {
      name: `${swiftClassName}.swift`,
      content: swiftCode,
      language: 'swift',
      platform: 'ios',
      subdirectory: [],
    },
  ]

  return sourceFiles
}

/** Conforms the borrowed bridge type of an `Inline<...>` parameter to `InlineCallback`. */
export function createSwiftInlineCallbackBridge(type: SwiftCallbackType): SourceFile[] {
  const swiftStructName = type.inlineSpecializationName
  const bridgeNamespace = NitroConfig.current.getSwiftBridgeNamespace('swift')
  const swiftParameterTypes = type.type.parameters.map((parameter) => parameter.getCode('swift', { context: 'type-argument' }))
  const swiftReturnType = type.type.returnType.getCode('swift', {
    context: 'return',
  })
  const swiftToCppCallCode = createSwiftSyncCallCode({
    type: type,
    bridgeFunction: `call_${swiftStructName}`,
  })
  const publicSwiftTypes = [type.type, type]
  const wrappedSwiftTypes = [type.returnType, ...type.parameters, type.syncResult]
  const swiftImports = getImportsCode([
    { language: 'swift', name: 'NitroModules', access: 'public' },
    { language: 'swift', name: 'CxxStdlib', access: 'internal' },
    ...getSwiftImports(publicSwiftTypes, 'public'),
    ...getSwiftImports(wrappedSwiftTypes, 'internal'),
  ])
  const swiftCode = `
${createFileMetadataString(`${swiftStructName}.swift`)}

${swiftImports}

public typealias ${swiftStructName} = ${bridgeNamespace}.${swiftStructName}

extension ${swiftStructName}: InlineCallback {
  public typealias Arguments = (${swiftParameterTypes.join(', ')})
  public typealias Return = ${swiftReturnType}
  public typealias Escaped = ${type.specializationName}
  private typealias bridge = ${bridgeNamespace}

  public func callAsFunction(_ arguments: Arguments) throws -> Return {
    ${indent(swiftToCppCallCode, '    ')}
  }
}
`.trim()
  return [
    {
      name: `${swiftStructName}.swift`,
      content: swiftCode,
      language: 'swift',
      platform: 'ios',
      subdirectory: [],
    },
  ]
}
