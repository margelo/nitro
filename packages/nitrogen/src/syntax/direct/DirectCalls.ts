import type { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import { escapeCppName } from '../helpers.js'
import type { Method } from '../Method.js'
import type { Type } from '../types/Type.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { StructType } from '../types/StructType.js'

/**
 * Direct JSI host functions for static methods.
 *
 * For static methods whose arguments and results are numbers, booleans, strings, or structs of numbers and
 * booleans, Nitrogen generates a `jsi::HostFunction` that reads the arguments straight from JSI's argument array
 * and calls the native implementation with plain values. On iOS, it calls a `@_cdecl` Swift entry point, which
 * skips the Swift/C++ interop wrappers. Any other input calls the method's regular JSI implementation.
 * See `DirectCall.hpp` in Nitro.
 */

type DirectScalarKind = 'number' | 'boolean'

export interface DirectStruct {
  readonly name: string
  readonly fields: readonly { readonly name: string; readonly kind: DirectScalarKind }[]
}

export type DirectValue =
  | { readonly kind: DirectScalarKind }
  | { readonly kind: 'string' }
  | { readonly kind: 'struct'; readonly struct: DirectStruct }

export type DirectResult = DirectValue | { readonly kind: 'void' }

export interface DirectParameter {
  readonly name: string
  readonly value: DirectValue
}

export interface DirectMethod {
  readonly name: string
  readonly parameters: readonly DirectParameter[]
  readonly result: DirectResult
}

function getDirectStruct(type: Type): DirectStruct | undefined {
  const struct = getTypeAs(type, StructType)
  // Structs from other Nitro modules may live in other namespaces and packages.
  if (struct.sourceConfig.isExternalConfig) return undefined
  const fields: { name: string; kind: DirectScalarKind }[] = []
  for (const property of struct.properties) {
    if (property.kind !== 'number' && property.kind !== 'boolean') return undefined
    fields.push({ name: property.name, kind: property.kind })
  }
  return { name: struct.structName, fields: fields }
}

function getDirectValue(type: Type): DirectValue | undefined {
  switch (type.kind) {
    case 'number':
    case 'boolean':
      return { kind: type.kind }
    case 'string':
      return { kind: 'string' }
    case 'struct': {
      const struct = getDirectStruct(type)
      return struct != null ? { kind: 'struct', struct: struct } : undefined
    }
    default:
      return undefined
  }
}

/** Returns the direct call of `method`, or `undefined` if its signature has none. */
export function getDirectMethod(method: Method): DirectMethod | undefined {
  const parameters: DirectParameter[] = []
  for (const parameter of method.parameters) {
    const value = getDirectValue(parameter.type)
    if (value == null) return undefined
    parameters.push({ name: parameter.name, value: value })
  }
  let result: DirectResult
  if (method.returnType.kind === 'void') {
    result = { kind: 'void' }
  } else {
    const value = getDirectValue(method.returnType)
    if (value == null) return undefined
    result = value
  }
  return { name: method.name, parameters: parameters, result: result }
}

/** Returns the direct calls of the `methods` that have one. */
export function getDirectMethods(methods: readonly Method[]): DirectMethod[] {
  return methods.map(getDirectMethod).filter((method): method is DirectMethod => method != null)
}

// MARK: - Shared C++

/** The name of the C++ function that creates the direct host function of `method`. */
export function getDirectFactoryName(method: DirectMethod): string {
  return `direct_${method.name}`
}

function getStructNamesConstant(struct: DirectStruct): string {
  return `kDirectNames_${struct.name}`
}

function getStructNamesLocal(struct: DirectStruct): string {
  return `__names_${struct.name}`
}

/** The structs `methods` read or create, each once. */
function getDirectStructs(methods: readonly DirectMethod[]): DirectStruct[] {
  const structs = new Map<string, DirectStruct>()
  for (const method of methods) {
    const values: DirectResult[] = [...method.parameters.map((parameter) => parameter.value), method.result]
    for (const value of values) {
      if (value.kind === 'struct') structs.set(value.struct.name, value.struct)
    }
  }
  return [...structs.values()]
}

function createCppStructNames(struct: DirectStruct): string {
  const names = struct.fields.map((field) => `"${field.name}"`).join(', ')
  return `
// The properties of \`${struct.name}\`, in the order direct host functions read and write them.
constexpr const char* ${getStructNamesConstant(struct)}[] = {${names}};
`.trim()
}

/** The C++ local holding argument `parameter`, or one of its fields. */
function getCppLocal(parameter: DirectParameter, field?: string): string {
  if (field != null) return `__${parameter.name}__${field}`
  return escapeCppName(parameter.name)
}

function getCppScalarType(kind: DirectScalarKind): string {
  return kind === 'number' ? 'double' : 'bool'
}

const FALLBACK = 'return __fallback(__runtime, __this, __args, __count);'

/**
 * Checks the arguments of `method` and reads its numbers, booleans and struct fields.
 * Anything else falls back to the regular JSI implementation.
 */
function createCppArgumentReads(method: DirectMethod): string[] {
  const lines: string[] = []
  const typeChecks = method.parameters.map((parameter, index) => {
    switch (parameter.value.kind) {
      case 'number':
        return `!__args[${index}].isNumber()`
      case 'boolean':
        return `!__args[${index}].isBool()`
      case 'string':
        return `!__args[${index}].isString()`
      case 'struct':
        return `!__args[${index}].isObject()`
    }
  })
  lines.push(
    `
if (${[`__count != ${method.parameters.length}`, ...typeChecks].join(' || ')}) [[unlikely]] {
  ${FALLBACK}
}
`.trim()
  )
  method.parameters.forEach((parameter, index) => {
    const value = parameter.value
    switch (value.kind) {
      case 'number':
        lines.push(`double ${getCppLocal(parameter)} = __args[${index}].getNumber();`)
        break
      case 'boolean':
        lines.push(`bool ${getCppLocal(parameter)} = __args[${index}].getBool();`)
        break
      case 'string':
        break
      case 'struct': {
        const names = getStructNamesLocal(value.struct)
        const declarations = value.struct.fields.map((field) => `${getCppScalarType(field.kind)} ${getCppLocal(parameter, field.name)};`)
        const reads = value.struct.fields.map(
          (_, fieldIndex) => `jsi::Value __value${fieldIndex} = __object.getProperty(__runtime, (*${names})[${fieldIndex}]);`
        )
        const checks = value.struct.fields.map(
          (field, fieldIndex) => `!__value${fieldIndex}.${field.kind === 'number' ? 'isNumber' : 'isBool'}()`
        )
        const assignments = value.struct.fields.map(
          (field, fieldIndex) =>
            `${getCppLocal(parameter, field.name)} = __value${fieldIndex}.${field.kind === 'number' ? 'getNumber' : 'getBool'}();`
        )
        lines.push(
          `
${declarations.join('\n')}
{
  jsi::Object __object = __args[${index}].getObject(__runtime);
  ${indent(reads.join('\n'), '  ')}
  if (${checks.join(' || ')}) [[unlikely]] {
    ${FALLBACK}
  }
  ${indent(assignments.join('\n'), '  ')}
}
`.trim()
        )
        break
      }
    }
  })
  return lines
}

function createCppStructResult(struct: DirectStruct, getField: (fieldIndex: number) => string): string {
  const names = getStructNamesLocal(struct)
  const writes = struct.fields.map(
    (_, fieldIndex) => `__object.setProperty(__runtime, (*${names})[${fieldIndex}], ${getField(fieldIndex)});`
  )
  return `
jsi::Object __object(__runtime);
${writes.join('\n')}
return jsi::Value(std::move(__object));
`.trim()
}

/**
 * Creates the factory of `method`'s direct host function. `captures` are created once per Runtime,
 * and `body` runs on every call.
 */
function createCppFactory(method: DirectMethod, captures: { name: string; value: string }[], body: string[]): string {
  const structs = getDirectStructs([method])
  const allCaptures = [
    ...structs.map((struct) => ({
      name: getStructNamesLocal(struct),
      value: `createNames(__runtime, ${getStructNamesConstant(struct)})`,
    })),
    ...captures,
  ]
  const captureList = ['__fallback', ...allCaptures.map((capture) => capture.name)].join(', ')
  const setup = allCaptures.map((capture) => `auto ${capture.name} = ${capture.value};\n  `).join('')
  return `
jsi::HostFunctionType ${getDirectFactoryName(method)}(jsi::Runtime& __runtime, const jsi::HostFunctionType& __fallback) {
  ${setup}return [${captureList}](jsi::Runtime& __runtime, const jsi::Value& __this, const jsi::Value* __args, size_t __count) -> jsi::Value {
    ${indent(body.join('\n'), '    ')}
  };
}
`.trim()
}

export interface DirectCppCode {
  /** Includes the generated C++ file needs. */
  includes: string[]
  /** Code before the C++ namespace, like `extern "C"` declarations. */
  prelude: string
  /** Definitions inside the C++ namespace, in an anonymous namespace. */
  definitions: string
  /** Statements that run in `Class::get()` before the registrations. */
  setup: string[]
}

function createCppDefinitions(methods: readonly DirectMethod[], extra: string[], factories: string[]): string {
  const structNames = getDirectStructs(methods).map(createCppStructNames)
  return `
namespace {
  using namespace margelo::nitro::direct;

  ${indent([...extra, ...structNames].join('\n\n'), '  ')}

  // Direct host functions. Each reads its arguments straight from JSI and calls the implementation with plain values.
  // Anything unusual goes to the regular JSI implementation, \`__fallback\`.

  ${indent(factories.join('\n\n'), '  ')}
} // namespace
`.trim()
}

// MARK: - iOS

/** The C symbol of the Swift entry point of `method`. */
function getSwiftEntryPoint(config: NitroConfig, specName: string, method: DirectMethod): string {
  return `__nitro_direct_${config.getIosModuleName()}_${specName}_${method.name}`
}

function getSwiftScalarType(kind: DirectScalarKind): string {
  return kind === 'number' ? 'Double' : 'Bool'
}

interface SwiftEntryPoint {
  cDeclaration: string
  cppCall: string[]
  swiftFunction: string
}

function createSwiftEntryPoint(
  config: NitroConfig,
  specName: string,
  implementationClassName: string,
  method: DirectMethod
): SwiftEntryPoint {
  const symbol = getSwiftEntryPoint(config, specName, method)
  const cParameters: string[] = []
  const cArguments: string[] = []
  const swiftParameters: string[] = []
  const swiftArguments: string[] = []
  const cppCall: string[] = []
  for (const parameter of method.parameters) {
    const value = parameter.value
    const local = getCppLocal(parameter)
    switch (value.kind) {
      case 'number':
      case 'boolean':
        cParameters.push(`${getCppScalarType(value.kind)} ${local}`)
        cArguments.push(local)
        swiftParameters.push(`_ ${parameter.name}: ${getSwiftScalarType(value.kind)}`)
        swiftArguments.push(`${parameter.name}: ${parameter.name}`)
        break
      case 'string': {
        const prefix = `__${parameter.name}`
        cppCall.push(`StringData ${local};`, `readString(__runtime, __args[${method.parameters.indexOf(parameter)}], ${local});`)
        cParameters.push(`const void* ${prefix}_data`, `size_t ${prefix}_length`, `bool ${prefix}_ascii`)
        cArguments.push(`${local}.data()`, `${local}.length()`, `${local}.isASCII()`)
        swiftParameters.push(`_ ${prefix}_data: UnsafeRawPointer?`, `_ ${prefix}_length: Int`, `_ ${prefix}_ascii: Bool`)
        swiftArguments.push(`${parameter.name}: nitroDirectString(${prefix}_data, ${prefix}_length, ${prefix}_ascii)`)
        break
      }
      case 'struct': {
        const fieldArguments: string[] = []
        for (const field of value.struct.fields) {
          const fieldLocal = getCppLocal(parameter, field.name)
          cParameters.push(`${getCppScalarType(field.kind)} ${fieldLocal}`)
          cArguments.push(fieldLocal)
          swiftParameters.push(`_ ${fieldLocal}: ${getSwiftScalarType(field.kind)}`)
          fieldArguments.push(`${field.name}: ${fieldLocal}`)
        }
        swiftArguments.push(`${parameter.name}: ${value.struct.name}(${fieldArguments.join(', ')})`)
        break
      }
    }
  }
  const invocation = `try ${implementationClassName}.${method.name}(${swiftArguments.join(', ')})`
  let cReturnType = 'void'
  let swiftReturn = ''
  let swiftBody: string
  let swiftFailure = ''
  let cppResult: string
  cppCall.push('std::string __error;')
  const result = method.result
  switch (result.kind) {
    case 'void':
      swiftBody = invocation
      cppCall.push(`${symbol}(${[...cArguments, '&__error'].join(', ')});`)
      cppResult = 'return jsi::Value::undefined();'
      break
    case 'number':
    case 'boolean':
      cReturnType = getCppScalarType(result.kind)
      swiftReturn = ` -> ${getSwiftScalarType(result.kind)}`
      swiftBody = `return ${invocation}`
      swiftFailure = result.kind === 'number' ? 'return 0' : 'return false'
      cppCall.push(`${cReturnType} __result = ${symbol}(${[...cArguments, '&__error'].join(', ')});`)
      cppResult = 'return jsi::Value(__result);'
      break
    case 'string':
      cParameters.push('void* __result')
      swiftParameters.push('_ __result: UnsafeMutableRawPointer')
      swiftBody = [`let __value = ${invocation}`, 'nitroDirectSetString(__result, __value)'].join('\n')
      cppCall.push('std::string __result;')
      cppCall.push(`${symbol}(${[...cArguments, '&__result', '&__error'].join(', ')});`)
      cppResult = 'return jsi::String::createFromUtf8(__runtime, reinterpret_cast<const uint8_t*>(__result.data()), __result.size());'
      break
    case 'struct': {
      const outArguments: string[] = []
      const assignments: string[] = []
      result.struct.fields.forEach((field) => {
        const name = `__result__${field.name}`
        cParameters.push(`${getCppScalarType(field.kind)}* ${name}`)
        swiftParameters.push(`_ ${name}: UnsafeMutablePointer<${getSwiftScalarType(field.kind)}>`)
        outArguments.push(`&${name}`)
        assignments.push(`${name}.pointee = __value.${field.name}`)
        cppCall.push(`${getCppScalarType(field.kind)} ${name};`)
      })
      swiftBody = [`let __value = ${invocation}`, ...assignments].join('\n')
      cppCall.push(`${symbol}(${[...cArguments, ...outArguments, '&__error'].join(', ')});`)
      cppResult = createCppStructResult(result.struct, (fieldIndex) => `__result__${result.struct.fields[fieldIndex]!.name}`)
      break
    }
  }
  cParameters.push('void* __error')
  swiftParameters.push('_ __error: UnsafeMutableRawPointer')
  cppCall.push(
    `
if (!__error.empty()) [[unlikely]] {
  throwError(__runtime, "${method.name}", __error);
}
${cppResult}
`.trim()
  )
  const swiftCatch = ['nitroDirectSetError(__error, error)']
  if (swiftFailure !== '') swiftCatch.push(swiftFailure)
  const swiftFunction = `
@_cdecl("${symbol}")
public func ${symbol}(
  ${indent(swiftParameters.join(',\n'), '  ')}
)${swiftReturn} {
  do {
    ${indent(swiftBody, '    ')}
  } catch {
    ${indent(swiftCatch.join('\n'), '    ')}
  }
}
`.trim()
  return {
    cDeclaration: `${cReturnType} ${symbol}(${cParameters.join(', ')});`,
    cppCall: cppCall,
    swiftFunction: swiftFunction,
  }
}

export interface SwiftDirectCode {
  cpp: DirectCppCode
  /** The Swift entry points, for `Hybrid<T>Spec_direct.swift`. */
  swiftFileName: string
  swiftCode: string
}

export function createSwiftDirectCode(
  config: NitroConfig,
  specName: string,
  hybridTSpec: string,
  hybridTSpecSwift: string,
  implementationClassName: string,
  methods: readonly DirectMethod[]
): SwiftDirectCode | undefined {
  if (methods.length === 0) return undefined
  const entryPoints = methods.map((method) => createSwiftEntryPoint(config, specName, implementationClassName, method))
  const factories = methods.map((method, index) =>
    createCppFactory(method, [], [...createCppArgumentReads(method), ...entryPoints[index]!.cppCall])
  )
  const prelude = `
// Swift entry points from \`${hybridTSpec}_direct.swift\`.
extern "C" {
  ${indent(entryPoints.map((entryPoint) => entryPoint.cDeclaration).join('\n'), '  ')}
}
`.trim()
  const swiftCode = `
// C entry points for the direct JSI host functions in \`${hybridTSpecSwift}.cpp\`.
// They take and return plain C values, so calls skip Swift/C++ interop wrappers.

${entryPoints.map((entryPoint) => entryPoint.swiftFunction).join('\n\n')}
`.trim()
  return {
    cpp: {
      includes: ['#include <NitroModules/DirectCall.hpp>', '#include <string>'],
      prelude: prelude,
      definitions: createCppDefinitions(methods, [], factories),
      setup: [],
    },
    swiftFileName: `${hybridTSpec}_direct.swift`,
    swiftCode: swiftCode,
  }
}
