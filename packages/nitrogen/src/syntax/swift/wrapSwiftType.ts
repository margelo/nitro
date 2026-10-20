import { SwiftPointerType } from './types/SwiftPointerType.js'
import { SwiftResultType } from './types/SwiftResultType.js'
import { ArrayType } from '../types/ArrayType.js'
import { CallbackType } from '../types/CallbackType.js'
import { EnumType } from '../types/EnumType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { NamedWrappingType } from '../types/NamedWrappingType.js'
import { OptionalType } from '../types/OptionalType.js'
import { PromiseType } from '../types/PromiseType.js'
import { RecordType } from '../types/RecordType.js'
import { StructType } from '../types/StructType.js'
import { VariantType } from '../types/VariantType.js'
import type { Type } from '../types/Type.js'
import { SwiftAnyJSONType } from './types/SwiftAnyJSONType.js'
import { SwiftArrayType } from './types/SwiftArrayType.js'
import { SwiftCallbackType } from './types/SwiftCallbackType.js'
import { SwiftEnumType } from './types/SwiftEnumType.js'
import { SwiftErrorType } from './types/SwiftErrorType.js'
import { SwiftHybridObjectType } from './types/SwiftHybridObjectType.js'
import { SwiftOptionalType } from './types/SwiftOptionalType.js'
import { SwiftPromiseType } from './types/SwiftPromiseType.js'
import { SwiftRecordType } from './types/SwiftRecordType.js'
import { SwiftStringType } from './types/SwiftStringType.js'
import { SwiftStructType } from './types/SwiftStructType.js'
import { SwiftVariantType } from './types/SwiftVariantType.js'
import { SwiftDirectType } from './types/SwiftDirectType.js'
import { SwiftVoidType } from './types/SwiftVoidType.js'
import type { SwiftType } from './types/SwiftType.js'

export function wrapSwiftType(type: Type): SwiftType {
  if (type instanceof SwiftResultType) return type
  if (type instanceof SwiftPointerType) return type
  if (type instanceof NamedWrappingType) return wrapSwiftType(type.type)
  switch (type.kind) {
    case 'number':
    case 'boolean':
    case 'int64':
    case 'uint64':
    case 'array-buffer':
    case 'null':
      return new SwiftDirectType(type)
    case 'void':
      return new SwiftVoidType()
    case 'enum':
      return new SwiftEnumType(getTypeAs(type, EnumType))
    case 'callback':
      return new SwiftCallbackType(getTypeAs(type, CallbackType))
    case 'promise':
      return new SwiftPromiseType(getTypeAs(type, PromiseType))
    case 'record':
      return new SwiftRecordType(getTypeAs(type, RecordType))
    case 'string':
      return new SwiftStringType()
    case 'array':
      return new SwiftArrayType(getTypeAs(type, ArrayType))
    case 'optional':
      return new SwiftOptionalType(getTypeAs(type, OptionalType))
    case 'any-json':
      return new SwiftAnyJSONType()
    case 'error':
      return new SwiftErrorType()
    case 'hybrid-object':
      return new SwiftHybridObjectType(getTypeAs(type, HybridObjectType))
    case 'struct':
      return new SwiftStructType(getTypeAs(type, StructType))
    case 'variant':
      return new SwiftVariantType(getTypeAs(type, VariantType))
    default:
      throw new Error(`Swift interop for ${type.kind} is not yet implemented`)
  }
}

/** Types named by callback/promise aliases before the local generated Swift header. */
export function wrapSwiftTypeForBridge(type: Type): SwiftType {
  const swiftType = wrapSwiftType(type)
  if (
    swiftType instanceof SwiftArrayType ||
    swiftType instanceof SwiftOptionalType
  ) {
    return swiftType.getBridgeType()
  }
  return swiftType
}
