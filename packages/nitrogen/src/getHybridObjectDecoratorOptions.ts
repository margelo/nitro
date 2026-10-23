import { Node, SyntaxKind, type ClassDeclaration, type Decorator } from 'ts-morph'
import type { Platform } from './getPlatformSpecs.js'

export type LiteralValue = string | boolean | LiteralValue[] | LiteralOptions
export interface LiteralOptions {
  [name: string]: LiteralValue
}
export type DecoratorOptions = Partial<Record<Platform, LiteralOptions>>

function getDecoratorPlatform(decorator: Decorator, name: string): Platform {
  const expression = decorator.getCallExpression()?.getExpression() ?? decorator.getExpression()
  let symbol = expression.getSymbol()
  if (symbol?.isAlias()) symbol = symbol.getAliasedSymbol()
  const decoratorName = symbol?.getName() ?? decorator.getName()
  switch (decoratorName) {
    case 'Apple':
    case 'iOS':
      return 'apple'
    case 'Android':
      return 'android'
    default:
      throw new Error(
        `${name}: Unsupported decorator \`@${decorator.getName()}(...)\`. Use \`@Apple(...)\` (or its alias \`@iOS(...)\`) or \`@Android(...)\`.`
      )
  }
}

function getLiteralValue(node: Node, name: string): LiteralValue {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText()
  }
  if (Node.isTrueLiteral(node) || Node.isFalseLiteral(node)) {
    return node.getLiteralValue()
  }
  if (Node.isArrayLiteralExpression(node)) {
    return node.getElements().map((element) => getLiteralValue(element, name))
  }
  if (Node.isObjectLiteralExpression(node)) {
    const names = new Set<string>()
    const entries = node.getProperties().map((property): [string, LiteralValue] => {
      if (!Node.isPropertyAssignment(property)) {
        throw new Error(
          `${name}: Platform decorator options must use explicit property assignments. Spreads, shorthand properties, methods and accessors are not supported.`
        )
      }
      const nameNode = property.getNameNode()
      if (!Node.isIdentifier(nameNode) && !Node.isStringLiteral(nameNode)) {
        throw new Error(
          `${name}: Platform decorator option names must be identifiers or string literals. Computed names are not supported.`
        )
      }
      let propertyName: string
      if (Node.isStringLiteral(nameNode)) {
        propertyName = nameNode.getLiteralText()
      } else {
        propertyName = nameNode.getText()
      }
      if (names.has(propertyName)) {
        throw new Error(`${name}: Platform decorator option "${propertyName}" is declared more than once.`)
      }
      names.add(propertyName)
      return [propertyName, getLiteralValue(property.getInitializerOrThrow(), `${name}.${propertyName}`)]
    })
    return Object.fromEntries(entries)
  }
  throw new Error(
    `${name}: Platform decorator options must use string or boolean literals, arrays, and literal objects. Expressions and references are not evaluated.`
  )
}

function getLiteralOptions(decorator: Decorator, name: string): LiteralOptions {
  const argumentsList = decorator.getArguments()
  const options = argumentsList.at(0)
  if (argumentsList.length !== 1 || options == null || !Node.isObjectLiteralExpression(options)) {
    throw new Error(`${name}: \`@Apple(...)\`, \`@iOS(...)\` and \`@Android(...)\` require one literal options object.`)
  }
  const result = getLiteralValue(options, name)
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`${name}: Platform decorator options must be a literal object.`)
  }
  return result
}

export function getHybridObjectDecoratorOptions(declaration: ClassDeclaration, name: string): DecoratorOptions | undefined {
  const decorators = declaration.getDescendantsOfKind(SyntaxKind.Decorator)
  if (decorators.length === 0) return undefined

  const result: DecoratorOptions = {}
  for (const decorator of decorators) {
    if (decorator.getParent() !== declaration) {
      throw new Error(`${name}: Platform decorators are supported only on HybridObject classes, not interfaces or members.`)
    }
    const platform = getDecoratorPlatform(decorator, name)
    if (result[platform] != null) {
      const aliasHint = platform === 'apple' ? ' `@iOS(...)` is an alias of `@Apple(...)`, so use only one of them.' : ''
      throw new Error(`${name}: Platform ${platform} is configured by more than one decorator.${aliasHint}`)
    }
    result[platform] = getLiteralOptions(decorator, name)
  }
  return result
}
