import { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import type { BridgedType } from '../BridgedType.js'
import { getForwardDeclaration } from '../c++/getForwardDeclaration.js'
import {
  getHybridObjectName,
  type HybridObjectName,
} from '../getHybridObjectName.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { ArrayType } from '../types/ArrayType.js'
import { EnumType } from '../types/EnumType.js'
import { FunctionType } from '../types/FunctionType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { OptionalType } from '../types/OptionalType.js'
import { PromiseType } from '../types/PromiseType.js'
import { RecordType } from '../types/RecordType.js'
import { StructType } from '../types/StructType.js'
import { TupleType } from '../types/TupleType.js'
import type { Type } from '../types/Type.js'
import { VariantType } from '../types/VariantType.js'
import { getReferencedTypes } from '../getReferencedTypes.js'
import {
  createSwiftCxxHelpers,
  type SwiftCxxHelper,
} from './SwiftCxxTypeHelper.js'
import { createSwiftEnumBridge } from './SwiftEnum.js'
import { createSwiftStructBridge } from './SwiftStruct.js'
import { createSwiftVariant } from './SwiftVariant.js'
import { VoidType } from '../types/VoidType.js'
import { NamedWrappingType } from '../types/NamedWrappingType.js'
import { ErrorType } from '../types/ErrorType.js'
import { createSwiftFunctionBridge } from './SwiftFunction.js'
import type { Language } from '../../getPlatformSpecs.js'

// TODO: Remove enum bridge once Swift fixes bidirectional enums crashing the `-Swift.h` header.

export class SwiftCxxBridgedType implements BridgedType<'swift', 'c++'> {
  readonly type: Type
  private readonly isBridgingToDirectCppTarget: boolean

  constructor(type: Type, isBridgingToDirectCppTarget: boolean = false) {
    this.type = type
    this.isBridgingToDirectCppTarget = isBridgingToDirectCppTarget
  }

  get hasType(): boolean {
    return this.type.kind !== 'void'
  }

  get canBePassedByReference(): boolean {
    return this.type.canBePassedByReference
  }

  get needsSpecialHandling(): boolean {
    switch (this.type.kind) {
      case 'enum':
        // Enums cannot be referenced from C++ <-> Swift bi-directionally,
        // so we just pass the underlying raw value (int32), and cast from Int <-> Enum.
        if (this.isBridgingToDirectCppTarget) {
          // ...unless we bridge directly to a C++ target. Then we don't need special conversion.
          return false
        }
        return true
      case 'hybrid-object':
        // Swift HybridObjects need to be wrapped in our own *Cxx Swift classes.
        // We wrap/unwrap them if needed.
        return true
      case 'optional':
        // swift::Optional<T> <> std::optional<T>
        return true
      case 'null':
        // NullType <> nitro::null
        return true
      case 'string':
        // swift::String <> std::string
        return true
      case 'array':
        // swift::Array<T> <> std::vector<T>
        return true
      case 'record':
        // Dictionary<K, V> <> std::unordered_map<K, V>
        return true
      case 'variant':
        // Variant_A_B_C <> std::variant<A, B, C>
        return true
      case 'tuple':
        // (A, B) <> std::tuple<A, B>
        return true
      case 'function':
        // (@ecaping () -> Void) <> std::function<...>
        return true
      case 'array-buffer':
        // ArrayBufferHolder <> std::shared_ptr<ArrayBuffer>
        return true
      case 'date':
        // Date <> double
        return true
      case 'promise':
        // Promise<T> <> std::shared_ptr<Promise<T>>
        return true
      case 'error':
        // Error <> std.exception_ptr
        return true
      case 'map':
        // AnyMapHolder <> AnyMap
        return true
      case 'result-wrapper':
        // Result<T> <> T
        return true
      default:
        return false
    }
  }

  getRequiredBridge(): SwiftCxxHelper | undefined {
    // Since Swift doesn't support C++ templates, we need to create helper
    // functions that create those types (specialized) for us.
    return createSwiftCxxHelpers(this.type)
  }

  private getBridgeOrThrow(): SwiftCxxHelper {
    const bridge = this.getRequiredBridge()
    if (bridge == null)
      throw new Error(
        `Type ${this.type.kind} requires a bridged specialization!`
      )
    return bridge
  }

  getRequiredImports(language: Language): SourceImport[] {
    const imports = this.type.getRequiredImports(language)

    if (language === 'c++') {
      if (this.type.kind === 'array-buffer') {
        imports.push({
          name: 'NitroModules/ArrayBufferHolder.hpp',
          forwardDeclaration: getForwardDeclaration(
            'class',
            'ArrayBufferHolder',
            'NitroModules'
          ),
          language: 'c++',
          space: 'system',
        })
      }
    }

    // Recursively look into referenced types (e.g. the `T` of a `optional<T>`, or `T` of a `T[]`)
    const referencedTypes = getReferencedTypes(this.type)
    referencedTypes.forEach((t) => {
      if (t === this.type) {
        // break a recursion - we already know this type
        return
      }
      const bridged = new SwiftCxxBridgedType(t)
      imports.push(...bridged.getRequiredImports(language))
    })

    return imports
  }

  getExtraFiles(): SourceFile[] {
    const files: SourceFile[] = []

    switch (this.type.kind) {
      case 'struct': {
        const struct = getTypeAs(this.type, StructType)
        const extensionFile = createSwiftStructBridge(struct)
        files.push(extensionFile)
        extensionFile.referencedTypes.forEach((t) => {
          const bridge = new SwiftCxxBridgedType(t)
          files.push(...bridge.getExtraFiles())
        })
        break
      }
      case 'enum': {
        const enumType = getTypeAs(this.type, EnumType)
        const extensionFile = createSwiftEnumBridge(enumType)
        files.push(extensionFile)
        break
      }
      case 'function': {
        const functionType = getTypeAs(this.type, FunctionType)
        const extensionFile = createSwiftFunctionBridge(functionType)
        files.push(extensionFile)
        break
      }
      case 'promise': {
        // Promise needs resolver and rejecter funcs in Swift
        const promiseType = getTypeAs(this.type, PromiseType)
        files.push(createSwiftFunctionBridge(promiseType.resolverFunction))
        files.push(createSwiftFunctionBridge(promiseType.rejecterFunction))
        break
      }
      case 'variant': {
        const variant = getTypeAs(this.type, VariantType)
        const file = createSwiftVariant(variant)
        files.push(file)
        break
      }
    }

    // Recursively look into referenced types (e.g. the `T` of a `optional<T>`, or `T` of a `T[]`)
    const referencedTypes = getReferencedTypes(this.type)
    referencedTypes.forEach((t) => {
      if (t === this.type) {
        // break a recursion - we already know this type
        return
      }
      const bridged = new SwiftCxxBridgedType(t)
      files.push(...bridged.getExtraFiles())
    })

    return files
  }

  getTypeCode(language: 'swift' | 'c++'): string {
    switch (this.type.kind) {
      case 'enum':
        if (this.isBridgingToDirectCppTarget) {
          return this.type.getCode('swift')
        }
        switch (language) {
          case 'c++':
            return 'int'
          case 'swift':
            return 'Int32'
          default:
            throw new Error(`Invalid language! ${language}`)
        }
      case 'map': {
        switch (language) {
          case 'swift':
            return 'margelo.nitro.SharedAnyMap'
          default:
            return this.type.getCode(language)
        }
      }
      case 'hybrid-object':
      case 'optional':
      case 'array':
      case 'function':
      case 'variant':
      case 'tuple':
      case 'record':
      case 'result-wrapper':
      case 'promise': {
        const bridge = this.getBridgeOrThrow()
        switch (language) {
          case 'swift':
            return `bridge.${bridge.specializationName}`
          case 'c++':
            return bridge.cxxType
          default:
            return this.type.getCode(language)
        }
      }
      case 'null':
        switch (language) {
          case 'swift':
            return 'margelo.nitro.NullType'
          default:
            return this.type.getCode(language)
        }
      case 'array-buffer':
        if (this.isBridgingToDirectCppTarget) {
          return this.type.getCode(language)
        } else {
          switch (language) {
            case 'swift':
              return 'ArrayBuffer'
            case 'c++':
              return `ArrayBufferHolder`
            default:
              throw new Error(`Invalid language! ${language}`)
          }
        }
      case 'string': {
        switch (language) {
          case 'c++':
            return `std::string`
          case 'swift':
            return 'std.string'
          default:
            throw new Error(`Invalid language! ${language}`)
        }
      }
      case 'date':
        switch (language) {
          case 'swift':
            return `margelo.nitro.chrono_time`
          default:
            return this.type.getCode(language)
        }
      case 'error':
        switch (language) {
          case 'c++':
            return 'std::exception_ptr'
          case 'swift':
            return 'std.exception_ptr'
          default:
            throw new Error(`Invalid language! ${language}`)
        }
      default:
        // No workaround - just return normal type
        return this.type.getCode(language)
    }
  }

  parse(
    parameterName: string,
    from: 'c++' | 'swift',
    to: 'swift' | 'c++',
    inLanguage: 'swift' | 'c++'
  ): string {
    if (from === 'c++') {
      return this.parseFromCppToSwift(parameterName, inLanguage)
    } else if (from === 'swift') {
      return this.parseFromSwiftToCpp(parameterName, inLanguage)
    } else {
      throw new Error(`Cannot parse from ${from} to ${to}!`)
    }
  }

  parseFromCppToSwift(
    cppParameterName: string,
    language: 'swift' | 'c++'
  ): string {
    switch (this.type.kind) {
      case 'enum': {
        if (this.isBridgingToDirectCppTarget) {
          return cppParameterName
        }
        const enumType = getTypeAs(this.type, EnumType)
        switch (language) {
          case 'c++':
            return `static_cast<int>(${cppParameterName})`
          case 'swift':
            const fullName = NitroConfig.current.getCxxNamespace(
              'swift',
              enumType.enumName
            )
            return `${fullName}(rawValue: ${cppParameterName})!`
          default:
            throw new Error(`Invalid language! ${language}`)
        }
      }
      case 'hybrid-object': {
        const bridge = this.getBridgeOrThrow()
        const getFunc = `bridge.get_${bridge.specializationName}`
        const name = getTypeHybridObjectName(this.type)
        switch (language) {
          case 'swift':
            return `
{ () -> any ${name.HybridTSpec} in
  let __unsafePointer = ${getFunc}(${cppParameterName})
  let __instance = ${name.HybridTSpecCxx}.fromUnsafe(__unsafePointer)
  return __instance.get${name.HybridTSpec}()
}()`.trim()
          default:
            return cppParameterName
        }
      }
      case 'array-buffer': {
        switch (language) {
          case 'swift':
            if (this.isBridgingToDirectCppTarget) {
              return `ArrayBuffer(${cppParameterName})`
            } else {
              return cppParameterName
            }
          case 'c++':
            if (this.isBridgingToDirectCppTarget) {
              return cppParameterName
            } else {
              return `ArrayBufferHolder(${cppParameterName})`
            }
          default:
            return cppParameterName
        }
      }
      case 'promise': {
        const promise = getTypeAs(this.type, PromiseType)
        switch (language) {
          case 'swift': {
            const bridge = this.getBridgeOrThrow()
            if (promise.resultingType.kind === 'void') {
              // It's void - resolve()
              const resolverFunc = new FunctionType(new VoidType(), [])
              const rejecterFunc = new FunctionType(new VoidType(), [
                new NamedWrappingType('error', new ErrorType()),
              ])
              const resolverFuncBridge = new SwiftCxxBridgedType(resolverFunc)
              const rejecterFuncBridge = new SwiftCxxBridgedType(rejecterFunc)
              return `
{ () -> ${promise.getCode('swift')} in
  let __promise = ${promise.getCode('swift')}()
  let __resolver = { __promise.resolve(withResult: ()) }
  let __rejecter = { (__error: Error) in
    __promise.reject(withError: __error)
  }
  let __resolverCpp = ${indent(resolverFuncBridge.parseFromSwiftToCpp('__resolver', 'swift'), '  ')}
  let __rejecterCpp = ${indent(rejecterFuncBridge.parseFromSwiftToCpp('__rejecter', 'swift'), '  ')}
  let __promiseHolder = bridge.wrap_${bridge.specializationName}(${cppParameterName})
  __promiseHolder.addOnResolvedListener(__resolverCpp)
  __promiseHolder.addOnRejectedListener(__rejecterCpp)
  return __promise
}()`.trim()
            } else {
              // It's resolving to a type - resolve(T)
              const resolverFunc = new FunctionType(new VoidType(), [
                new NamedWrappingType('result', promise.resultingType),
              ])
              const rejecterFunc = new FunctionType(new VoidType(), [
                new NamedWrappingType('error', new ErrorType()),
              ])
              const resolverFuncBridge = new SwiftCxxBridgedType(resolverFunc)
              const rejecterFuncBridge = new SwiftCxxBridgedType(rejecterFunc)
              const resolverFuncName = promise.resultingType
                .canBePassedByReference
                ? 'addOnResolvedListener'
                : 'addOnResolvedListenerCopy'
              return `
{ () -> ${promise.getCode('swift')} in
  let __promise = ${promise.getCode('swift')}()
  let __resolver = { (__result: ${promise.resultingType.getCode('swift')}) in
    __promise.resolve(withResult: __result)
  }
  let __rejecter = { (__error: Error) in
    __promise.reject(withError: __error)
  }
  let __resolverCpp = ${indent(resolverFuncBridge.parseFromSwiftToCpp('__resolver', 'swift'), '  ')}
  let __rejecterCpp = ${indent(rejecterFuncBridge.parseFromSwiftToCpp('__rejecter', 'swift'), '  ')}
  let __promiseHolder = bridge.wrap_${bridge.specializationName}(${cppParameterName})
  __promiseHolder.${resolverFuncName}(__resolverCpp)
  __promiseHolder.addOnRejectedListener(__rejecterCpp)
  return __promise
}()`.trim()
            }
          }
          default:
            return cppParameterName
        }
      }
      case 'null':
        switch (language) {
          case 'swift':
            return `NullType.null`
          default:
            return cppParameterName
        }
      case 'optional': {
        const optional = getTypeAs(this.type, OptionalType)
        const wrapping = new SwiftCxxBridgedType(optional.wrappingType, true)
        const bridge = this.getBridgeOrThrow()
        switch (language) {
          case 'swift':
            if (wrapping.type.kind === 'enum') {
              const enumType = getTypeAs(wrapping.type, EnumType)
              if (enumType.jsType === 'enum') {
                // TODO: Remove this hack once Swift fixes this shit.
                // A JS enum is implemented as a number/int based enum.
                // For some reason, those break in Swift. I have no idea why.
                return `${cppParameterName}.has_value() ? ${cppParameterName}.pointee : nil`
              }
            }
            // TODO: Remove this check for booleans/doubles once https://github.com/swiftlang/swift/issues/84848 is fixed.
            //       Right now, optionals of doubles or booleans (and who knows what else?) fail to compile when `.value` is used.
            const swiftBug84848Workaround =
              optional.wrappingType.kind === 'boolean' ||
              optional.wrappingType.kind === 'number'
            if (!swiftBug84848Workaround) {
              if (!wrapping.needsSpecialHandling) {
                return `${cppParameterName}.value`
              }
            }
            return `
{ () -> ${optional.getCode('swift')} in
  if bridge.has_value_${bridge.specializationName}(${cppParameterName}) {
    let __unwrapped = bridge.get_${bridge.specializationName}(${cppParameterName})
    return ${indent(wrapping.parseFromCppToSwift('__unwrapped', language), '    ')}
  } else {
    return nil
  }
}()
  `.trim()
          default:
            return cppParameterName
        }
      }
      case 'string': {
        switch (language) {
          case 'swift':
            return `String(${cppParameterName})`
          default:
            return cppParameterName
        }
      }
      case 'date': {
        switch (language) {
          case 'swift':
            return `Date(fromChrono: ${cppParameterName})`.trim()
          default:
            return cppParameterName
        }
      }
      case 'array': {
        const array = getTypeAs(this.type, ArrayType)
        const wrapping = new SwiftCxxBridgedType(array.itemType, true)
        switch (language) {
          case 'swift':
            // We have to iterate the element one by one to create a resulting Array (mapped)
            return `${cppParameterName}.map({ __item in ${wrapping.parseFromCppToSwift('__item', 'swift')} })`.trim()
          default:
            return cppParameterName
        }
      }
      case 'map': {
        switch (language) {
          case 'swift':
            return `AnyMap(withCppPart: ${cppParameterName})`
          default:
            return cppParameterName
        }
      }
      case 'record': {
        const bridge = this.getBridgeOrThrow()
        const getKeysFunc = `bridge.get_${bridge.specializationName}_keys`
        const getValueFunc = `bridge.get_${bridge.specializationName}_value`
        const record = getTypeAs(this.type, RecordType)
        const wrappingKey = new SwiftCxxBridgedType(record.keyType, true)
        const wrappingValue = new SwiftCxxBridgedType(record.valueType, true)
        switch (language) {
          case 'swift':
            return `
{ () -> ${record.getCode('swift')} in
  var __dictionary = ${record.getCode('swift')}(minimumCapacity: ${cppParameterName}.size())
  let __keys = ${getKeysFunc}(${cppParameterName})
  for __key in __keys {
    let __value = ${getValueFunc}(${cppParameterName}, __key)
    __dictionary[${indent(wrappingKey.parseFromCppToSwift('__key', 'swift'), '    ')}] = ${indent(wrappingValue.parseFromCppToSwift('__value', 'swift'), '    ')}
  }
  return __dictionary
}()`.trim()
          default:
            return cppParameterName
        }
      }
      case 'tuple': {
        switch (language) {
          case 'swift':
            return `${cppParameterName}.arg0`
          default:
            return cppParameterName
        }
      }
      case 'variant': {
        const bridge = this.getBridgeOrThrow()
        const variant = getTypeAs(this.type, VariantType)
        const valueInitialization = this.isBridgingToDirectCppTarget
          ? `bridge.${bridge.specializationName}(${cppParameterName})`
          : cppParameterName
        const cases = variant.cases
          .map(([label, v], i) => {
            const wrapping = new SwiftCxxBridgedType(v, true)
            const parse = wrapping.parseFromCppToSwift('__actual', 'swift')
            return `
case ${i}:
  let __actual = __variant.get_${i}()
  return .${label}(${indent(parse, '  ')})`.trim()
          })
          .join('\n')
        switch (language) {
          case 'swift':
            return `
{ () -> ${variant.getCode('swift')} in
  let __variant = ${valueInitialization}
  switch __variant.index() {
    ${indent(cases, '    ')}
    default:
      fatalError("Variant can never have index \\(__variant.index())!")
  }
}()`.trim()
          default:
            return cppParameterName
        }
      }
      case 'function': {
        const funcType = getTypeAs(this.type, FunctionType)
        switch (language) {
          case 'swift':
            const swiftClosureType = funcType.getCode('swift', {
              includeNameInfo: false,
            })
            const bridge = this.getBridgeOrThrow()
            const paramsSignature = funcType.parameters.map(
              (p) => `__${p.escapedName}: ${p.getCode('swift')}`
            )
            const returnType = funcType.returnType.getCode('swift')
            const signature = `(${paramsSignature.join(', ')}) -> ${returnType}`
            const paramsForward = funcType.parameters.map((p) => {
              const bridged = new SwiftCxxBridgedType(p)
              return bridged.parseFromSwiftToCpp(`__${p.escapedName}`, 'swift')
            })

            if (funcType.returnType.kind === 'void') {
              return `
{ () -> ${swiftClosureType} in
  let __wrappedFunction = bridge.wrap_${bridge.specializationName}(${cppParameterName})
  return { ${signature} in
    __wrappedFunction.call(${indent(paramsForward.join(', '), '    ')})
  }
}()`.trim()
            } else {
              const resultBridged = new SwiftCxxBridgedType(
                funcType.returnType,
                true
              )
              return `
{ () -> ${swiftClosureType} in
  let __wrappedFunction = bridge.wrap_${bridge.specializationName}(${cppParameterName})
  return { ${signature} in
    let __result = __wrappedFunction.call(${indent(paramsForward.join(', '), '    ')})
    return ${indent(resultBridged.parseFromCppToSwift('__result', 'swift'), '    ')}
  }
}()`.trim()
            }
          default:
            return cppParameterName
        }
      }
      case 'error':
        switch (language) {
          case 'swift':
            return `RuntimeError.from(cppError: ${cppParameterName})`
          default:
            return cppParameterName
        }
      case 'void':
        // When type is void, don't return anything
        return ''
      default:
        // No workaround - we can just use the value we get from C++
        return cppParameterName
    }
  }

  parseFromSwiftToCpp(
    swiftParameterName: string,
    language: 'swift' | 'c++'
  ): string {
    switch (this.type.kind) {
      case 'enum':
        if (this.isBridgingToDirectCppTarget) {
          return swiftParameterName
        }
        // TODO: Remove the int casting once https://github.com/swiftlang/swift/issues/75330 is fixed.
        switch (language) {
          case 'c++':
            return `static_cast<${this.type.getCode('c++')}>(${swiftParameterName})`
          case 'swift':
            return `${swiftParameterName}.rawValue`
          default:
            throw new Error(`Invalid language! ${language}`)
        }
      case 'hybrid-object': {
        const bridge = this.getBridgeOrThrow()
        switch (language) {
          case 'swift':
            return `
{ () -> bridge.${bridge.specializationName} in
  let __cxxWrapped = ${swiftParameterName}.getCxxWrapper()
  return __cxxWrapped.getCxxPart()
}()`.trim()
          default:
            return swiftParameterName
        }
      }
      case 'null':
        switch (language) {
          case 'swift':
            return `margelo.nitro.NullType.null`
          default:
            return swiftParameterName
        }
      case 'optional': {
        const optional = getTypeAs(this.type, OptionalType)
        const wrapping = new SwiftCxxBridgedType(optional.wrappingType, true)
        const bridge = this.getBridgeOrThrow()
        const makeFunc = `bridge.${bridge.funcName}`
        switch (language) {
          case 'swift':
            return `
{ () -> bridge.${bridge.specializationName} in
  if let __unwrappedValue = ${swiftParameterName} {
    return ${makeFunc}(${indent(wrapping.parseFromSwiftToCpp('__unwrappedValue', language), '    ')})
  } else {
    return .init()
  }
}()
  `.trim()
          default:
            return swiftParameterName
        }
      }
      case 'string': {
        switch (language) {
          case 'swift':
            return `std.string(${swiftParameterName})`
          default:
            return swiftParameterName
        }
      }
      case 'date': {
        switch (language) {
          case 'swift':
            return `${swiftParameterName}.toCpp()`
          default:
            return swiftParameterName
        }
      }
      case 'array-buffer': {
        switch (language) {
          case 'swift':
            if (this.isBridgingToDirectCppTarget) {
              return `${swiftParameterName}.getArrayBuffer()`
            } else {
              return swiftParameterName
            }
          case 'c++':
            if (this.isBridgingToDirectCppTarget) {
              return swiftParameterName
            } else {
              return `${swiftParameterName}.getArrayBuffer()`
            }
          default:
            return swiftParameterName
        }
      }
      case 'map': {
        switch (language) {
          case 'swift':
            return `${swiftParameterName}.cppPart`
          default:
            return swiftParameterName
        }
      }
      case 'promise': {
        const bridge = this.getBridgeOrThrow()
        const makePromise = `bridge.${bridge.funcName}`
        const promise = getTypeAs(this.type, PromiseType)
        const resolvingType = new SwiftCxxBridgedType(
          promise.resultingType,
          true
        )
        switch (language) {
          case 'swift':
            const arg =
              promise.resultingType.kind === 'void'
                ? ''
                : resolvingType.parseFromSwiftToCpp('__result', 'swift')
            return `
{ () -> bridge.${bridge.specializationName} in
  let __promise = ${makePromise}()
  let __promiseHolder = bridge.wrap_${bridge.specializationName}(__promise)
  ${swiftParameterName}
    .then({ __result in __promiseHolder.resolve(${indent(arg, '      ')}) })
    .catch({ __error in __promiseHolder.reject(__error.toCpp()) })
  return __promise
}()`.trim()
          default:
            return swiftParameterName
        }
      }
      case 'array': {
        const bridge = this.getBridgeOrThrow()
        const array = getTypeAs(this.type, ArrayType)
        const wrapping = new SwiftCxxBridgedType(array.itemType, true)
        switch (language) {
          case 'swift':
            // array has to be iterated and converted one-by-one
            const makeFunc = `bridge.${bridge.funcName}`
            return `
{ () -> bridge.${bridge.specializationName} in
  var __vector = ${makeFunc}(${swiftParameterName}.count)
  for __item in ${swiftParameterName} {
    __vector.push_back(${indent(wrapping.parseFromSwiftToCpp('__item', language), '    ')})
  }
  return __vector
}()`.trim()
          default:
            return swiftParameterName
        }
      }
      case 'tuple': {
        const tuple = getTypeAs(this.type, TupleType)
        const bridge = this.getBridgeOrThrow()
        const makeFunc = NitroConfig.current.getCxxNamespace(
          language,
          bridge.funcName
        )
        switch (language) {
          case 'swift':
            const typesForward = tuple.itemTypes
              .map((t, i) => {
                const bridged = new SwiftCxxBridgedType(t)
                return `${bridged.parseFromSwiftToCpp(`${swiftParameterName}.${i}`, language)}`
              })
              .join(', ')
            return `${makeFunc}(${typesForward})`
          default:
            return swiftParameterName
        }
      }
      case 'variant': {
        const bridge = this.getBridgeOrThrow()
        const variant = getTypeAs(this.type, VariantType)
        switch (language) {
          case 'swift':
            const cases = variant.cases
              .map(([label, v]) => {
                const wrapping = new SwiftCxxBridgedType(v, true)
                const parse = wrapping.parseFromSwiftToCpp('__value', 'swift')
                return `
case .${label}(let __value):
  return bridge.${bridge.funcName}(${indent(parse, '  ')})`.trim()
              })
              .join('\n')
            let code = `
{ () -> bridge.${bridge.specializationName} in
  switch ${swiftParameterName} {
    ${indent(cases, '    ')}
  }
}()`.trim()
            if (this.isBridgingToDirectCppTarget) {
              // If we bridge directly to a C++ variant, we need to return the .variant of our wrapper type.
              code += `.variant`
            }
            return code
          default:
            return swiftParameterName
        }
      }
      case 'record': {
        const bridge = this.getBridgeOrThrow()
        const createMap = `bridge.${bridge.funcName}`
        const record = getTypeAs(this.type, RecordType)
        const wrappingKey = new SwiftCxxBridgedType(record.keyType, true)
        const wrappingValue = new SwiftCxxBridgedType(record.valueType, true)
        switch (language) {
          case 'swift':
            return `
{ () -> bridge.${bridge.specializationName} in
  var __map = ${createMap}(${swiftParameterName}.count)
  for (__k, __v) in ${swiftParameterName} {
    bridge.emplace_${bridge.specializationName}(&__map, ${indent(wrappingKey.parseFromSwiftToCpp('__k', 'swift'), '    ')}, ${indent(wrappingValue.parseFromSwiftToCpp('__v', 'swift'), '    ')})
  }
  return __map
}()`.trim()
          default:
            return swiftParameterName
        }
      }
      case 'function': {
        switch (language) {
          case 'swift': {
            const bridge = this.getBridgeOrThrow()
            const createFunc = `bridge.${bridge.funcName}`
            return `
{ () -> bridge.${bridge.specializationName} in
  let __closureWrapper = ${bridge.specializationName}(${swiftParameterName})
  return ${createFunc}(__closureWrapper.toUnsafe())
}()
  `.trim()
          }
          default:
            return swiftParameterName
        }
      }
      case 'error':
        switch (language) {
          case 'swift':
            return `${swiftParameterName}.toCpp()`
          default:
            return swiftParameterName
        }
      case 'void':
        // When type is void, don't return anything
        return ''
      default:
        // No workaround - we can just use the value we get from C++
        return swiftParameterName
    }
  }
}

function getTypeHybridObjectName(type: Type): HybridObjectName {
  const hybridObject = getTypeAs(type, HybridObjectType)
  return getHybridObjectName(hybridObject.hybridObjectName)
}
