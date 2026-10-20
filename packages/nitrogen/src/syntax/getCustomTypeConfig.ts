import type { CustomTypeConfig } from 'nitro-core'
import type { Type as TSMorphType } from 'ts-morph'

interface Result {
  name: string
  config: CustomTypeConfig
}

export function getCustomTypeConfig(type: TSMorphType): Result {
  const parts = type.getIntersectionTypes()
  for (const part of parts) {
    const typeNameProperty = part.getProperty('__customTypeName')
    if (typeNameProperty == null) continue
    const typeConfigProperty = part.getProperty('__customTypeConfig')
    if (typeConfigProperty == null) continue

    const declaration = type.getAliasSymbolOrThrow().getDeclarations()[0]
    if (declaration == null)
      throw new Error(`Type has no declaration! ${type.getText()}`)

    const typeNameTypeOrUndefined =
      typeNameProperty.getTypeAtLocation(declaration)
    const typeConfigTypeOrUndefined =
      typeConfigProperty.getTypeAtLocation(declaration)

    const typeNameType = typeNameTypeOrUndefined
      .getUnionTypes()
      .find((t) => t.isLiteral())
    if (typeNameType == null) continue
    const typeConfigType = typeConfigTypeOrUndefined
      .getUnionTypes()
      .find((t) => t.isObject())
    if (typeConfigType == null) continue

    const typeName = typeNameType.getLiteralValue()
    if (typeof typeName !== 'string') {
      throw new Error(
        `CustomType's second argument (TypeName) needs to be a string! Instead, it is a ${typeof typeName} (${typeName})`
      )
    }
    const includeType = typeConfigType
      .getPropertyOrThrow('include')
      .getTypeAtLocation(declaration)
    const include = includeType.getLiteralValue()
    if (typeof include !== 'string')
      throw new Error(
        `CustomType's third argument (Config) needs to contain { include }, which should be a string! (It is ${includeType.getText()} instead)`
      )
    const canBePassedByReferenceType = typeConfigType
      .getProperty('canBePassedByReference')
      ?.getTypeAtLocation(declaration)
      .getUnionTypes()
      .find((u) => u.isBooleanLiteral())
      ?.getLiteralValue()
    const canBePassedByReference =
      typeof canBePassedByReferenceType === 'boolean'
        ? canBePassedByReferenceType
        : false

    return {
      name: typeName,
      config: {
        include: include,
        canBePassedByReference: canBePassedByReference,
      },
    }
  }
  throw new Error(
    `Type looks like a CustomType<...>, but doesn't have generic arguments! ${type.getText()}`
  )
}
