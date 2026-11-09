import { ArrayType } from '../types/ArrayType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { OptionalType } from '../types/OptionalType.js'
import type { Type } from '../types/Type.js'
import { isKotlinPrimitiveArray } from './isKotlinPrimitiveArray.js'

interface KotlinHashCodeOptions {
  type: Type
  value: string
}

export function getKotlinHashCode({ type, value }: KotlinHashCodeOptions): string {
  switch (type.kind) {
    case 'array': {
      const array = getTypeAs(type, ArrayType)
      if (isKotlinPrimitiveArray(array)) {
        return `${value}.contentHashCode()`
      } else {
        return `${value}.contentDeepHashCode()`
      }
    }
    case 'optional': {
      const optional = getTypeAs(type, OptionalType)
      const hash = getKotlinHashCode({ type: optional.wrappingType, value: value })
      return `(if (${value} != null) ${hash} else 0)`
    }
    default:
      return `${value}.hashCode()`
  }
}
