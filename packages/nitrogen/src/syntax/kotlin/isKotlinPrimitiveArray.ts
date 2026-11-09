import type { ArrayType } from '../types/ArrayType.js'

export function isKotlinPrimitiveArray(array: ArrayType): boolean {
  switch (array.itemType.kind) {
    case 'number':
    case 'boolean':
    case 'int64':
      return true
    default:
      return false
  }
}
