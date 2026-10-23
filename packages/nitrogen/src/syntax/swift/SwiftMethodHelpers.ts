import { NitroConfig } from '../../config/NitroConfig.js'
import type { Method } from '../Method.js'
import type { StaticMethodOptions } from '../StaticMethod.js'
import { Parameter } from '../Parameter.js'
import type { SourceImport } from '../SourceFile.js'
import { indent } from '../../utils.js'
import { getSwiftImports } from './getSwiftImports.js'
import { wrapSwiftType } from './wrapSwiftType.js'
import { SwiftBorrowedPointerType } from './types/SwiftBorrowedPointerType.js'
import { SwiftCxxBorrowedPointerType } from './types/SwiftCxxBorrowedPointerType.js'
import { SwiftCxxOutPointerType } from './types/SwiftCxxOutPointerType.js'
import { SwiftOutPointerType } from './types/SwiftOutPointerType.js'
import { SwiftResultConsumerType } from './types/SwiftResultConsumerType.js'
import { SwiftResultType } from './types/SwiftResultType.js'
import { SwiftRetainedPointerType } from './types/SwiftRetainedPointerType.js'
import { SwiftVoidType } from './types/SwiftVoidType.js'
import type { SwiftType } from './types/SwiftType.js'

export interface SwiftArgument {
  name: string
  code: string
}

/** Swift functions exported to C++ take result storage as their last parameter. */
export const SWIFT_RESULT_STORAGE = '__outResult'
/** Throwing Swift functions returning Swift values take a result consumer instead. */
const SWIFT_RESULT_CONSUMER = '__onResult'

/** A value passed between C++ and a Swift function exported to C++. */
export interface SwiftBridgeParameter {
  name: string
  /** The value's representation in the Swift function's signature. */
  type: SwiftType
}

interface SwiftMethodParameter {
  native: Parameter
  swift: Parameter
  type: SwiftType
  exported: SwiftBridgeParameter
}

export interface SwiftMethodDefinition {
  method: Method
  body: string
}

/** How a constructor or static method's `_cxx` endpoint takes part in class inheritance. */
export type SwiftClassMethodOptions = Pick<StaticMethodOptions, 'override'>

export interface SwiftMethodBridge {
  cppMethods: SwiftMethodDefinition[]
  swiftMethod: SwiftMethodDefinition
  swiftImports: SourceImport<'swift'>[]
  cppRegistrations: string[]
}

/** The type adaptations shared by the native and exported Swift signatures. */
export interface SwiftMethodInfo {
  nativeMethod: Method
  returnType: SwiftType
  /** How the exported Swift function returns `returnType`. */
  exportedReturnType: SwiftType
  parameters: SwiftMethodParameter[]
  isThrowing: boolean
  resultType: SwiftResultType
}

export function prepareSwiftMethod(nativeMethod: Method, isThrowing: boolean, config: NitroConfig = NitroConfig.current): SwiftMethodInfo {
  const returnType = wrapSwiftType(nativeMethod.returnType, config)
  const parameters = nativeMethod.parameters.map((parameter) => {
    const swiftType = wrapSwiftType(parameter.type, config)
    let exportedType: SwiftType
    if (swiftType.requiresOpaqueCxxBridge) {
      exportedType = new SwiftCxxBorrowedPointerType(swiftType)
    } else {
      exportedType = swiftType
    }
    return {
      native: parameter,
      swift: new Parameter(parameter.name, swiftType),
      type: swiftType,
      exported: { name: parameter.type.escapedName, type: exportedType },
    }
  })
  let exportedReturnType: SwiftType
  if (returnType.requiresOpaqueCxxBridge) {
    exportedReturnType = new SwiftCxxOutPointerType(returnType)
  } else if (isThrowing && returnType.isReferenceType) {
    // A throwing class result crosses the boundary as an owned opaque pointer.
    exportedReturnType = new SwiftRetainedPointerType(returnType)
  } else if (isThrowing && !returnType.canImportFromCpp) {
    // Swift cannot import Result<T> while a Swift-native T is incomplete.
    // Return Result<void> and lend the successful value to C++ during the call.
    exportedReturnType = new SwiftResultConsumerType(returnType)
  } else {
    exportedReturnType = returnType
  }
  const resultType = getSwiftResultType(exportedReturnType, config)
  return {
    nativeMethod: nativeMethod,
    returnType: returnType,
    exportedReturnType: exportedReturnType,
    parameters: parameters,
    isThrowing: isThrowing,
    resultType: resultType,
  }
}

/** The Result returned by a Swift function; indirect results use a separate parameter. */
export function getSwiftResultType(returnType: SwiftType, config: NitroConfig = NitroConfig.current): SwiftResultType {
  if (returnType instanceof SwiftOutPointerType || returnType instanceof SwiftResultConsumerType) {
    return new SwiftResultType(new SwiftVoidType(), config)
  }
  return new SwiftResultType(returnType, config)
}

/** The parameters of a Swift function exported to C++, including indirect results. */
export function getSwiftBridgeParameters(parameters: SwiftBridgeParameter[], returnType: SwiftType): SwiftBridgeParameter[] {
  if (returnType instanceof SwiftResultConsumerType) {
    return [...parameters, { name: SWIFT_RESULT_CONSUMER, type: returnType }]
  }
  if (returnType instanceof SwiftOutPointerType) {
    return [...parameters, { name: SWIFT_RESULT_STORAGE, type: returnType }]
  }
  return parameters
}

interface CppToSwiftCallOptions {
  parameters: SwiftBridgeParameter[]
  returnType: SwiftType
  returnsVoid: boolean
  /** Calls the Swift function, which returns a Result, with its C++ arguments. */
  getCppInvocation: (args: string[]) => string
}

/**
 * C++ code that calls a Swift function and returns its value or throws its error.
 * Adapters borrow arguments and receive indirect results during the call.
 */
export function createCppToSwiftCall({ parameters, returnType, returnsVoid, getCppInvocation }: CppToSwiftCallOptions): string {
  // Borrowed pointers shadow the values they point to.
  const cppArguments = parameters.map((parameter) => parameter.name)
  let cppSwiftInvocation: string
  if (returnType instanceof SwiftResultConsumerType) {
    const cppConsumerArguments = [...cppArguments, SWIFT_RESULT_CONSUMER]
    const cppInvocation = getCppInvocation(cppConsumerArguments)
    cppSwiftInvocation = returnType.receive({ consumer: SWIFT_RESULT_CONSUMER, invocation: cppInvocation })
  } else if (returnType instanceof SwiftOutPointerType) {
    const cppStorageArguments = [...cppArguments, SWIFT_RESULT_STORAGE]
    cppSwiftInvocation = returnType.tryAllocate(SWIFT_RESULT_STORAGE, getCppInvocation(cppStorageArguments))
  } else {
    cppSwiftInvocation = getCppInvocation(cppArguments)
  }
  for (const { name, type } of parameters.toReversed()) {
    if (type instanceof SwiftBorrowedPointerType) {
      cppSwiftInvocation = type.tryBorrow(name, name, cppSwiftInvocation)
    }
  }
  let cppReturnCode = ''
  if (returnType instanceof SwiftRetainedPointerType) {
    cppReturnCode = `return ${returnType.take('c++', '__result.value()')};`
  } else if (!returnsVoid) {
    cppReturnCode = 'return std::move(__result.value());'
  }
  return `
auto __result = ${cppSwiftInvocation};
if (__result.hasError()) [[unlikely]] {
  std::rethrow_exception(__result.error());
}
${cppReturnCode}
`.trim()
}

interface CppBridgeBodyOptions {
  callable: SwiftMethodInfo
  getCppInvocation: (args: string[]) => string
}

export function createCppBridgeBody({ callable, getCppInvocation }: CppBridgeBodyOptions): string {
  const parameters = callable.parameters.map((parameter) => parameter.exported)
  if (!callable.isThrowing) {
    const cppArguments = parameters.map((parameter) => parameter.name)
    let cppInvocation: string
    if (callable.exportedReturnType instanceof SwiftCxxOutPointerType) {
      const cppInitializeCode = `${getCppInvocation([...cppArguments, SWIFT_RESULT_STORAGE])};`
      cppInvocation = callable.exportedReturnType.allocate('c++', {
        storage: SWIFT_RESULT_STORAGE,
        body: () => cppInitializeCode,
      })
    } else {
      cppInvocation = getCppInvocation(cppArguments)
    }
    // Borrowed pointers shadow the values they point to.
    for (const { name, type } of parameters.toReversed()) {
      if (type instanceof SwiftCxxBorrowedPointerType) {
        cppInvocation = type.tryBorrow(name, name, cppInvocation)
      }
    }
    return `
return ${cppInvocation};
`.trim()
  }
  return createCppToSwiftCall({
    parameters: parameters,
    returnType: callable.exportedReturnType,
    returnsVoid: callable.nativeMethod.returnType.kind === 'void',
    getCppInvocation: getCppInvocation,
  })
}

interface SwiftResultBodyOptions {
  /** The Swift call that produces the value. */
  invocation: string
  returnType: SwiftType
  /** The Swift name of the Result returned to C++. */
  resultType: string
  returnsVoid: boolean
}

/**
 * Swift statements that return the value of `invocation` to C++ as a Result,
 * supplying indirect results through a borrowed value or initialized storage.
 */
export function createSwiftResultBody({ invocation, returnType, resultType, returnsVoid }: SwiftResultBodyOptions): string {
  if (returnsVoid) {
    return `
${invocation}
return ${resultType}.withValue()
`.trim()
  }
  const swiftValue = returnType.fromSwift('value')
  if (returnType instanceof SwiftResultConsumerType) {
    const consumeCode = returnType.consume({ consumer: SWIFT_RESULT_CONSUMER, value: swiftValue })
    return `
let value = ${invocation}
${consumeCode}
return ${resultType}.withValue()
`.trim()
  }
  if (returnType instanceof SwiftOutPointerType) {
    const initializeCode = returnType.initialize('swift', SWIFT_RESULT_STORAGE, swiftValue)
    return `
let value = ${invocation}
${initializeCode}
return ${resultType}.withValue()
`.trim()
  }
  return `
let value = ${invocation}
return ${resultType}.withValue(${swiftValue})
`.trim()
}

/** Swift catches errors from `body` and returns them to C++ in a Result. */
export function createSwiftCatchBody(body: string, resultType: string): string {
  const swiftCatchBody = `
return ${resultType}.withError(error.toCpp())
`.trim()
  return `
do {
  ${indent(body, '  ')}
} catch {
  ${indent(swiftCatchBody, '  ')}
}
`.trim()
}

interface SwiftEndpointOptions {
  callable: SwiftMethodInfo
  getSwiftInvocation: (args: SwiftArgument[]) => string
}

interface SwiftEndpoint {
  returnType: SwiftType
  parameters: Parameter[]
  body: string
}

/** The exported Swift ABI uses pointers and Result where Swift requires them. */
export function createSwiftEndpoint({ callable, getSwiftInvocation }: SwiftEndpointOptions): SwiftEndpoint {
  const exportedReturnType = callable.exportedReturnType
  const returnsVoid = callable.nativeMethod.returnType.kind === 'void'
  const bridgeParameters = getSwiftBridgeParameters(
    callable.parameters.map((parameter) => parameter.exported),
    exportedReturnType
  )
  const exportedParameters = bridgeParameters.map(({ name, type }) => new Parameter(name, type, { generated: true }))
  const swiftArguments = callable.parameters.map(({ native, exported }) => ({
    name: native.name,
    code: exported.type.toSwift(exported.name),
  }))
  const swiftInvocation = getSwiftInvocation(swiftArguments)
  if (!callable.isThrowing) {
    let swiftMethodBody = swiftInvocation
    let swiftEndpointReturnType: SwiftType = exportedReturnType
    if (exportedReturnType instanceof SwiftCxxOutPointerType) {
      const initializeCode = exportedReturnType.initialize('swift', SWIFT_RESULT_STORAGE, exportedReturnType.fromSwift('value'))
      swiftMethodBody = `
let value = ${swiftInvocation}
${initializeCode}
`.trim()
      swiftEndpointReturnType = new SwiftVoidType()
    } else if (!returnsVoid) {
      swiftMethodBody = `
let value = ${swiftInvocation}
return ${exportedReturnType.fromSwift('value')}
`.trim()
    }
    return {
      parameters: exportedParameters,
      returnType: swiftEndpointReturnType,
      body: swiftMethodBody,
    }
  }
  const swiftResultType = `bridge.${callable.resultType.specializationName}`
  const swiftResultBody = createSwiftResultBody({
    invocation: swiftInvocation,
    returnType: exportedReturnType,
    resultType: swiftResultType,
    returnsVoid: returnsVoid,
  })
  const swiftMethodBody = createSwiftCatchBody(swiftResultBody, swiftResultType)
  return {
    parameters: exportedParameters,
    returnType: new SwiftResultType(callable.resultType.payload, callable.resultType.sourceConfig, 'bridge'),
    body: swiftMethodBody,
  }
}

export function getSwiftMethodImports(callable: SwiftMethodInfo): SourceImport<'swift'>[] {
  const publicSwiftTypes = callable.parameters.map((parameter) => parameter.exported.type)
  if (callable.isThrowing) {
    publicSwiftTypes.push(callable.resultType)
  } else {
    publicSwiftTypes.push(callable.exportedReturnType)
  }
  const swiftParameterTypes = callable.parameters.map((parameter) => parameter.type)
  const swiftImplementationTypes = [callable.returnType, callable.exportedReturnType, ...swiftParameterTypes]
  return [...getSwiftImports(publicSwiftTypes, 'public'), ...getSwiftImports(swiftImplementationTypes, 'internal')]
}
