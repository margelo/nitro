import { NamedWrappingType } from './NamedWrappingType.js'
import type { Type } from './Type.js'

export function getTypeAs<T>(
  type: Type,
  classReference: new (...args: any[]) => T
): T {
  if (type instanceof classReference) {
    return type
  } else if (type instanceof NamedWrappingType) {
    return getTypeAs(type.type, classReference)
  } else {
    throw new Error(`Type of kind "${type.kind}" is not a ${classReference}!`)
  }
}
