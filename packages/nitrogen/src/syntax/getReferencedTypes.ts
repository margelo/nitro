import { ArrayType } from './types/ArrayType.js'
import { FunctionType } from './types/FunctionType.js'
import { getTypeAs } from './types/getTypeAs.js'
import { OptionalType } from './types/OptionalType.js'
import { PromiseType } from './types/PromiseType.js'
import { RecordType } from './types/RecordType.js'
import { StructType } from './types/StructType.js'
import { TupleType } from './types/TupleType.js'
import type { Type } from './types/Type.js'
import { VariantType } from './types/VariantType.js'

export function getReferencedTypes(type: Type, visited: Set<Type> = new Set()): Type[] {
  if (visited.has(type)) return []
  visited.add(type)

  switch (type.kind) {
    case 'array':
      const array = getTypeAs(type, ArrayType)
      return [type, ...getReferencedTypes(array.itemType, visited)]

    case 'function':
      const func = getTypeAs(type, FunctionType)
      return [
        type,
        ...getReferencedTypes(func.returnType, visited),
        ...func.parameters.flatMap((t) => getReferencedTypes(t, visited)),
      ]

    case 'optional':
      const optional = getTypeAs(type, OptionalType)
      return [type, ...getReferencedTypes(optional.wrappingType, visited)]

    case 'promise':
      const promise = getTypeAs(type, PromiseType)
      return [type, ...getReferencedTypes(promise.resultingType, visited)]

    case 'record':
      const record = getTypeAs(type, RecordType)
      return [
        type,
        ...getReferencedTypes(record.keyType, visited),
        ...getReferencedTypes(record.valueType, visited),
      ]

    case 'struct':
      const struct = getTypeAs(type, StructType)
      return [type, ...struct.properties.flatMap((p) => getReferencedTypes(p, visited))]

    case 'tuple':
      const tuple = getTypeAs(type, TupleType)
      return [type, ...tuple.itemTypes.flatMap((t) => getReferencedTypes(t, visited))]

    case 'variant':
      const variant = getTypeAs(type, VariantType)
      return [type, ...variant.variants.flatMap((t) => getReferencedTypes(t, visited))]

    default:
      return [type]
  }
}
