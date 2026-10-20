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
import { TupleType } from '../types/TupleType.js'
import type { Type } from '../types/Type.js'
import { VariantType } from '../types/VariantType.js'
import { KotlinArrayBufferType } from './types/KotlinArrayBufferType.js'
import { KotlinArrayType } from './types/KotlinArrayType.js'
import { KotlinBooleanType } from './types/KotlinBooleanType.js'
import { KotlinCallbackType } from './types/KotlinCallbackType.js'
import { KotlinEnumType } from './types/KotlinEnumType.js'
import { KotlinErrorType } from './types/KotlinErrorType.js'
import { KotlinHybridObjectType } from './types/KotlinHybridObjectType.js'
import { KotlinInt64Type } from './types/KotlinInt64Type.js'
import { KotlinNullType } from './types/KotlinNullType.js'
import { KotlinNumberType } from './types/KotlinNumberType.js'
import { KotlinOptionalType } from './types/KotlinOptionalType.js'
import { KotlinPromiseType } from './types/KotlinPromiseType.js'
import { KotlinRecordType } from './types/KotlinRecordType.js'
import { KotlinStringType } from './types/KotlinStringType.js'
import { KotlinStructType } from './types/KotlinStructType.js'
import type { KotlinType, KotlinTypeOptions } from './types/KotlinType.js'
import { KotlinUInt64Type } from './types/KotlinUInt64Type.js'
import { KotlinUnsupportedType } from './types/KotlinUnsupportedType.js'
import { KotlinVariantType } from './types/KotlinVariantType.js'
import { KotlinVoidType } from './types/KotlinVoidType.js'

export function wrapKotlinType(
  type: Type,
  options: KotlinTypeOptions = {}
): KotlinType {
  if (type instanceof NamedWrappingType) {
    return wrapKotlinType(type.type, options)
  }
  switch (type.kind) {
    case 'number':
      return new KotlinNumberType(options)
    case 'boolean':
      return new KotlinBooleanType(options)
    case 'int64':
      return new KotlinInt64Type(options)
    case 'uint64':
      return new KotlinUInt64Type(options)
    case 'void':
      return new KotlinVoidType()
    case 'string':
      return new KotlinStringType()
    case 'null':
      return new KotlinNullType()
    case 'array-buffer':
      return new KotlinArrayBufferType()
    case 'error':
      return new KotlinErrorType()
    case 'enum':
      return new KotlinEnumType(getTypeAs(type, EnumType))
    case 'struct':
      return new KotlinStructType(getTypeAs(type, StructType))
    case 'variant':
      return new KotlinVariantType(getTypeAs(type, VariantType))
    case 'callback':
      return new KotlinCallbackType(getTypeAs(type, CallbackType))
    case 'hybrid-object':
      return new KotlinHybridObjectType(getTypeAs(type, HybridObjectType))
    case 'optional':
      return new KotlinOptionalType(getTypeAs(type, OptionalType))
    case 'array':
      return new KotlinArrayType(getTypeAs(type, ArrayType))
    case 'record':
      return new KotlinRecordType(getTypeAs(type, RecordType))
    case 'promise':
      return new KotlinPromiseType(getTypeAs(type, PromiseType))
    case 'tuple': {
      const tuple = getTypeAs(type, TupleType)
      return new KotlinUnsupportedType(
        type,
        tuple.itemTypes.map((item) => wrapKotlinType(item))
      )
    }
    case 'any-json':
    case 'custom-type':
    case 'hybrid-object-base':
      return new KotlinUnsupportedType(type, [])
    default:
      throw new Error(`Kotlin interop for ${type.kind} is not yet implemented`)
  }
}
