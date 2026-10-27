import { capitalizeName } from '../../utils.js'
import { getSwiftBridgeParameterType, getSwiftBridgeReturnType, SWIFT_RESULT_STORAGE } from './SwiftMethodHelpers.js'
import { SwiftCxxBorrowedPointerType } from './types/SwiftCxxBorrowedPointerType.js'
import { SwiftCxxOutPointerType } from './types/SwiftCxxOutPointerType.js'
import type { SwiftNamedType } from './types/SwiftNamedType.js'
import type { SwiftStructType } from './types/SwiftStructType.js'
import type { SwiftType } from './types/SwiftType.js'

export interface SwiftStructPropertyBridge {
  property: SwiftNamedType
  parameterType: SwiftType
  returnType: SwiftType
}

export function getSwiftStructPropertyBridges(type: SwiftStructType): SwiftStructPropertyBridge[] {
  return type.properties.map((property) => ({
    property: property,
    parameterType: getSwiftBridgeParameterType(property),
    returnType: getSwiftBridgeReturnType({ type: property, isThrowing: false }),
  }))
}

interface CppStructInitializerOptions {
  type: string
  properties: SwiftStructPropertyBridge[]
  getCppValue: (property: SwiftNamedType) => string
}

/** Keeps borrowed C++ values alive until Swift has copied them into the struct. */
export function createCppStructInitializer({ type, properties, getCppValue }: CppStructInitializerOptions): string {
  const cppInitializers: string[] = []
  const cppArguments = properties.map(({ property, parameterType }) => {
    const value = getCppValue(property)
    if (parameterType instanceof SwiftCxxBorrowedPointerType) {
      const name = `__${property.escapedName}`
      cppInitializers.push(`auto ${name} = ${value};`)
      return `std::addressof(${name})`
    }
    return value
  })
  const cppInitializerCode = `
return ${type}::init_cxx(${cppArguments.join(', ')});
`.trim()
  return [...cppInitializers, cppInitializerCode].join('\n')
}

interface CppStructGetterOptions {
  property: SwiftStructPropertyBridge
  receiver: string
}

export function createCppStructGetter({ property: { property, returnType }, receiver }: CppStructGetterOptions): string {
  const getterName = capitalizeName(property.escapedName)
  if (returnType instanceof SwiftCxxOutPointerType) {
    const cppInitializeCode = `
${receiver}.get${getterName}_cxx(${SWIFT_RESULT_STORAGE});
`.trim()
    return returnType.allocate('c++', {
      storage: SWIFT_RESULT_STORAGE,
      body: () => cppInitializeCode,
    })
  }
  return `${receiver}.get${getterName}_cxx()`
}
