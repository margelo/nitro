import { Node, type ts, type Type } from 'ts-morph'
import type { NamedType } from './types/Type.js'
import { createNamedType } from './createType.js'
import type { Language } from '../getPlatformSpecs.js'

export function getInterfaceProperties(
  language: Language,
  interfaceType: Type<ts.ObjectType>
): NamedType[] {
  const symbol = interfaceType.getAliasSymbol() ?? interfaceType.getSymbol()
  if (symbol == null)
    throw new Error(
      `Interface "${interfaceType.getText()}" does not have a Symbol!`
    )
  return interfaceType.getProperties().flatMap((prop) => {
    const propDeclaration = prop
      .getDeclarations()
      .find((declaration) => Node.isPropertySignature(declaration))
    // `property?: never` is a type-only marker for exclusive unions.
    // TypeScript resolves the property itself to `undefined`, so inspect its node.
    if (
      prop.isOptional() &&
      propDeclaration?.getTypeNode()?.getType().isNever()
    ) {
      return []
    }

    let propType = prop.getDeclaredType()
    if (propType.isAny() || propType.isUnknown()) {
      // the interface is aliased/merged - we need to look into the actual declaration
      for (const declaration of symbol.getDeclarations()) {
        const declared = prop.getTypeAtLocation(declaration)
        if (!declared.isAny() && !declared.isUnknown()) {
          propType = declared
          break
        }
      }
    }

    const refType = createNamedType(
      language,
      prop.getName(),
      propType,
      prop.isOptional() || propType.isNullable(),
      propDeclaration?.getTypeNode()
    )
    return [refType]
  })
}
