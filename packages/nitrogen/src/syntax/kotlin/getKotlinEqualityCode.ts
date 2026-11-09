import { ArrayType } from '../types/ArrayType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { OptionalType } from '../types/OptionalType.js'
import type { Type } from '../types/Type.js'

interface KotlinEqualityOptions {
  type: Type
  left: string
  right: string
}

export function getKotlinEqualityCode({ type, left, right }: KotlinEqualityOptions): string {
  switch (type.kind) {
    case 'array': {
      const array = getTypeAs(type, ArrayType)
      const isPrimitiveArray = ['number', 'boolean', 'int64'].includes(array.itemType.kind)
      const method = isPrimitiveArray ? 'contentEquals' : 'contentDeepEquals'
      return `
${left}.${method}(${right})
`.trim()
    }
    case 'optional': {
      const optional = getTypeAs(type, OptionalType)
      const comparison = getKotlinEqualityCode({ type: optional.wrappingType, left: left, right: right })
      return `
(${left} == null && ${right} == null || ${left} != null && ${right} != null && ${comparison})
`.trim()
    }
    case 'number':
      // Canonical bits make NaNs equal and distinguish signed zeros, matching Double.hashCode().
      return `
${left}.toBits() == ${right}.toBits()
`.trim()
    default:
      return `
${left} == ${right}
`.trim()
  }
}
