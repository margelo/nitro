import { ArrayType } from '../types/ArrayType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { OptionalType } from '../types/OptionalType.js'
import type { Type } from '../types/Type.js'
import { isKotlinPrimitiveArray } from './isKotlinPrimitiveArray.js'

interface KotlinEqualityOptions {
  type: Type
  left: string
  right: string
}

export function getKotlinEqualityCode({ type, left, right }: KotlinEqualityOptions): string {
  switch (type.kind) {
    case 'array': {
      const array = getTypeAs(type, ArrayType)
      if (isKotlinPrimitiveArray(array)) {
        return `${left}.contentEquals(${right})`
      } else {
        return `${left}.contentDeepEquals(${right})`
      }
    }
    case 'optional': {
      const optional = getTypeAs(type, OptionalType)
      const comparison = getKotlinEqualityCode({ type: optional.wrappingType, left: left, right: right })
      return `(${left} == null && ${right} == null || ${left} != null && ${right} != null && ${comparison})`
    }
    case 'number':
      // Canonical bits make NaNs equal and distinguish signed zeros, matching Double.hashCode().
      return `${left}.toBits() == ${right}.toBits()`
    default:
      return `${left} == ${right}`
  }
}
