import { ArrayType } from '../types/ArrayType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { OptionalType } from '../types/OptionalType.js'
import type { Type } from '../types/Type.js'

interface KotlinHashCodeOptions {
  type: Type
  value: string
}

export function getKotlinHashCode({ type, value }: KotlinHashCodeOptions): string {
  switch (type.kind) {
    case 'array': {
      const array = getTypeAs(type, ArrayType)
      const isPrimitiveArray = ['number', 'boolean', 'int64'].includes(array.itemType.kind)
      const method = isPrimitiveArray ? 'contentHashCode' : 'contentDeepHashCode'
      return `
${value}.${method}()
`.trim()
    }
    case 'optional': {
      const optional = getTypeAs(type, OptionalType)
      const hash = getKotlinHashCode({ type: optional.wrappingType, value: value })
      return `
(if (${value} != null) ${hash} else 0)
`.trim()
    }
    default:
      return `
${value}.hashCode()
`.trim()
  }
}
