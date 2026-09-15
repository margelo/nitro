import type { PlatformSpec } from 'react-native-nitro-modules'
import type { InterfaceDeclaration, Type, TypeAliasDeclaration } from 'ts-morph'
import { Symbol } from 'ts-morph'
import { getBaseTypes } from './utils.js'

export type Platform = keyof Required<PlatformSpec>
export type Language = Required<PlatformSpec>[keyof PlatformSpec]

const platformLanguages: { [K in Platform]: Language[] } = {
  ios: ['swift', 'c++'],
  android: ['kotlin', 'c++'],
  windows: ['c++'],
}
const allPlatforms = Object.keys(platformLanguages) as Platform[]
const allLanguages = Object.values(platformLanguages).flatMap((l) => l)

function isValidLanguage(language: string | undefined): language is Language {
  if (language == null) {
    return false
  }
  return allLanguages.includes(language as Language)
}

function isValidPlatform(platform: string): platform is Platform {
  return allPlatforms.includes(platform as Platform)
}

function getLiteralValue(symbol: Symbol): string | undefined {
  const value = symbol.getValueDeclaration()
  if (value == null) {
    return undefined
  }
  const type = value.getType()
  const literal = type.getLiteralValue()
  if (typeof literal === 'string') {
    return literal
  }
  return undefined
}

// TODO: The type casting result here doesn't really work in TS.
function isValidLanguageForPlatform(
  language: Language,
  platform: Platform
): language is Required<PlatformSpec>[typeof platform] {
  return platformLanguages[platform].includes(language)
}

function getPlatformSpec(typeName: string, platformSpecs: Type): PlatformSpec {
  const result: PlatformSpec = {}

  // Properties (ios, android)
  const properties = platformSpecs.getProperties()
  for (const property of properties) {
    // Property name (ios, android)
    const platform = property.getName()
    if (!isValidPlatform(platform)) {
      throw new Error(
        `${typeName} does not properly extend HybridObject<T> - "${platform}" is not a valid Platform! ` +
          `Valid platforms are: [${allPlatforms.join(', ')}]`
      )
    }

    // Value (swift, kotlin, c++)
    const language = getLiteralValue(property)
    if (!isValidLanguage(language)) {
      throw new Error(
        `${typeName}: Language ${language} is not a valid language for ${platform}! ` +
          `Valid languages are: [${platformLanguages[platform].join(', ')}]`
      )
    }

    // Double-check that language works on this platform (android: kotlin/c++, ios: swift/c++)
    if (!isValidLanguageForPlatform(language, platform)) {
      throw new Error(
        `${typeName}: Language ${language} is not a valid language for ${platform}! ` +
          `Valid languages are: [${platformLanguages[platform].join(', ')}]`
      )
    }

    // @ts-expect-error because TypeScript isn't smart enough yet to correctly cast after the `isValidLanguageForPlatform` check.
    result[platform] = language
  }

  return result
}

function isDirectlyType(type: Type, name: string): boolean {
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  if (symbol?.getName() === name) {
    return true
  }
  return false
}

function extendsType(type: Type, name: string, recursive: boolean): boolean {
  for (const base of getBaseTypes(type)) {
    const isHybrid = isDirectlyType(base, name)
    if (isHybrid) {
      return true
    }
    if (recursive) {
      const baseExtends = extendsType(base, name, recursive)
      if (baseExtends) {
        return true
      }
    }
  }
  return false
}

export function isDirectlyHybridObject(type: Type): boolean {
  return isDirectlyType(type, 'HybridObject')
}

export function isDirectlyAnyHybridObject(type: Type): boolean {
  return isDirectlyType(type, 'AnyHybridObject')
}

export function extendsHybridObject(type: Type, recursive: boolean): boolean {
  return extendsType(type, 'HybridObject', recursive)
}

export function isHybridViewProps(type: Type): boolean {
  return extendsType(type, 'HybridViewProps', true)
}
export function isHybridViewMethods(type: Type): boolean {
  return extendsType(type, 'HybridViewMethods', true)
}

export function isHybridView(type: Type): boolean {
  // HybridViews are type aliases for `HybridView`, and `Props & Methods` are just intersected together.
  const unionTypes = type.getIntersectionTypes()
  for (const union of unionTypes) {
    const symbol = union.getSymbol()
    if (symbol == null) return false
    return symbol.getName() === 'HybridViewTag'
  }
  return false
}

export function isAnyHybridSubclass(type: Type): boolean {
  if (isDirectlyHybridObject(type)) return false

  if (isHybridView(type)) return true

  if (extendsHybridObject(type, true)) return true

  return false
}

/**
 * If the given interface ({@linkcode declaration}) extends `HybridObject`,
 * this method returns the platforms it exists on.
 * If it doesn't extend `HybridObject`, this returns `undefined`.
 */
export function getHybridObjectPlatforms(
  declaration: InterfaceDeclaration | TypeAliasDeclaration
): PlatformSpec {
  const base = getBaseTypes(declaration.getType()).find((t) =>
    isDirectlyHybridObject(t)
  )
  if (base == null) {
    // this type does not extend `HybridObject`.
    throw new Error(
      `Couldn't find HybridObject<..> base for ${declaration.getName()}! (${declaration.getText()})`
    )
  }

  const genericArguments = base.getTypeArguments()
  const platformSpecsArgument = genericArguments[0]
  if (
    platformSpecsArgument == null ||
    platformSpecsArgument.getProperties().length === 0
  ) {
    // it uses `HybridObject` without generic arguments. We throw as we don't know what to generate.
    throw new Error(
      `HybridObject ${declaration.getName()} does not declare any platforms in the \`HybridObject\` type argument! ` +
        `Pass at least one platform (and language) to \`interface ${declaration.getName()} extends HybridObject<{ ... }>\``
    )
  }

  return getPlatformSpec(declaration.getName(), platformSpecsArgument)
}

export function getHybridViewPlatforms(
  view: InterfaceDeclaration | TypeAliasDeclaration
): PlatformSpec {
  const hybridViewTag = view
    .getType()
    .getIntersectionTypes()
    .find((type) => type.getSymbol()?.getName() === 'HybridViewTag')
  if (hybridViewTag == null) {
    throw new Error(
      `${view.getName()} looks like a HybridView, but doesn't contain HybridViewTag<...>!`
    )
  }

  const platformSpecArg = hybridViewTag.getTypeArguments()[0]
  if (platformSpecArg == null) {
    throw new Error(
      `${view.getName()} does not declare any platforms in HybridView<...>!`
    )
  }

  return getPlatformSpec(view.getName(), platformSpecArg)
}
