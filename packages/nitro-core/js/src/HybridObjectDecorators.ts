import type { HybridObjectPlatformOptions } from './HybridObjectPlatformOptions.js'

// A full ClassDecoratorContext requires a public constructor. Specs can also
// have protected or private constructors, so only constrain the decorator kind.
type HybridObjectDecorator = (
  target: unknown,
  context?: Pick<ClassDecoratorContext, 'kind'>
) => void

function createDecoratorCallError(name: 'iOS' | 'Android'): Error {
  return new Error(
    `\`@${name}(...)\` is a Nitrogen annotation for \`export declare class\` HybridObject specs and must never run. ` +
      `If the spec uses \`class\`, change it to \`declare class\`. ` +
      `If a transpiler emitted decorator calls for a declared class, as swc does with decorators enabled, ` +
      `compile \`.nitro.ts\` specs with tsc, esbuild, oxc or Babel instead, or use the library's built output.`
  )
}

/**
 * Selects the iOS implementation of a declared HybridObject class.
 * Nitrogen reads this literal configuration from the `.nitro.ts` spec.
 * Use it only on an `export declare class`, which emits no JavaScript, so this never runs.
 * @throws Always. A call means the spec uses `class` instead of `declare class`,
 * or a transpiler emitted decorator calls for a declared class.
 */
export function iOS(
  _options: HybridObjectPlatformOptions<'c++' | 'swift'>
): HybridObjectDecorator {
  throw createDecoratorCallError('iOS')
}

/**
 * Selects the Android implementation of a declared HybridObject class.
 * Nitrogen reads this literal configuration from the `.nitro.ts` spec.
 * Use it only on an `export declare class`, which emits no JavaScript, so this never runs.
 * @throws Always. A call means the spec uses `class` instead of `declare class`,
 * or a transpiler emitted decorator calls for a declared class.
 */
export function Android(
  _options: HybridObjectPlatformOptions<'c++' | 'kotlin'>
): HybridObjectDecorator {
  throw createDecoratorCallError('Android')
}
