import { NitroConfig } from '../../config/NitroConfig.js'
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

function isSwiftType(type: Type): type is SwiftType {
  return 'getProtocolConformances' in type
}

export function wrapSwiftType(type: Type, config: NitroConfig = NitroConfig.current): SwiftType {
  if (isSwiftType(type)) return type
  if (type instanceof NamedWrappingType) return wrapSwiftType(type.type, config)
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
    case 'enum': {
      const enumType = getTypeAs(type, EnumType)
      const owner = enumType.declaration.getOwner('swift', config)
      return new SwiftEnumType(enumType, owner)
    }
    case 'callback':
      return new SwiftCallbackType(getTypeAs(type, CallbackType), config)
    case 'promise':
      return new SwiftPromiseType(getTypeAs(type, PromiseType), config)
    case 'record':
      return new SwiftRecordType(getTypeAs(type, RecordType), config)
    case 'string':
      return new SwiftStringType()
    case 'array':
      return new SwiftArrayType(getTypeAs(type, ArrayType), config)
    case 'optional':
      return new SwiftOptionalType(getTypeAs(type, OptionalType), config)
    case 'any-json':
      return new SwiftAnyJSONType()
    case 'error':
      return new SwiftErrorType()
    case 'hybrid-object':
      return new SwiftHybridObjectType(getTypeAs(type, HybridObjectType))
    case 'struct': {
      const structType = getTypeAs(type, StructType)
      const owner = structType.declaration.getOwner('swift', config)
      return new SwiftStructType(structType, owner)
    }
    case 'variant':
      return new SwiftVariantType(getTypeAs(type, VariantType), config)
    default:
      throw new Error(`Swift interop for ${type.kind} is not yet implemented`)
  }
}

/** Types named by callback/promise aliases before the local generated Swift header. */
export function wrapSwiftTypeForBridge(type: Type, config: NitroConfig = NitroConfig.current): SwiftType {
  const swiftType = wrapSwiftType(type, config)
  if (swiftType instanceof SwiftArrayType || swiftType instanceof SwiftOptionalType) {
    return swiftType.getBridgeType()
  }
  return swiftType
}
