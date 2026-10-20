import type { HybridObject } from 'nitro-core'
import type { Language } from '../getPlatformSpecs.js'
import type { HybridObjectSpec } from './HybridObjectSpec.js'

function getMemberNamesOfBaseType(language: Language): string[] {
  switch (language) {
    case 'c++':
      // C++ classes don't have any base type.
      return []
    case 'swift':
      // Swift classes conform to `AnyObject`, but that doesn't have any properties
      return []
    case 'kotlin':
      // Kotlin/JVM classes always extends `Any`, which has 3 methods
      return ['toString', 'equals', 'hashCode']
  }
}
function getMemberNamesOfHybridObject(): string[] {
  type MemberName = keyof HybridObject
  type HasToContainAllKeys = { [P in MemberName]: boolean }
  const allKeys: HasToContainAllKeys = {
    __type: true,
    dispose: true,
    equals: true,
    toString: true,
  }
  return Object.keys(allKeys)
}

function flatBaseTypes(type: HybridObjectSpec): HybridObjectSpec[] {
  return type.baseTypes.flatMap((b) => [b, ...flatBaseTypes(b)])
}

/**
 * Returns true when the given {@linkcode memberName} is overriding a
 * property or method from any base class inside the given
 * {@linkcode hybridObject}'s prototype chain (all the way up).
 *
 * For example, `"toString"` would return `true` since it overrides from base HybridObject.
 * On Kotlin, `"hashCode"` would return `true` since it overrides from base `kotlin.Any`.
 */
export function isMemberOverridingFromBase(
  memberName: string,
  hybridObject: HybridObjectSpec,
  language: Language
): boolean {
  // 1. Check if the HybridObject inherits from other HybridObjects,
  //    if yes, check if those have properties of that given name.
  const allBases = flatBaseTypes(hybridObject)
  const anyBaseOverrides = allBases.some((h) => {
    if (h.properties.some((p) => p.name === memberName)) {
      return true
    }
    if (h.methods.some((m) => m.name === memberName)) {
      return true
    }
    return false
  })
  if (anyBaseOverrides) {
    // A HybridObject base type has the same property name - we need to override it.
    return true
  }

  // 2. Check if the base `HybridObject` type contains a property of the given name
  const baseHybridObjectProps = getMemberNamesOfHybridObject()
  if (baseHybridObjectProps.includes(memberName)) {
    return true
  }

  // 3. Check if the base type in our language contains a property of the given name
  const baseTypeProps = getMemberNamesOfBaseType(language)
  if (baseTypeProps.includes(memberName)) {
    return true
  }

  // 4. Apparently no base type has a property of that name - we are safe!
  return false
}
