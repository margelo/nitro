import type { HybridObject } from 'nitro-core'

/**
 * A native view backed by a Nitro HybridObject.
 *
 * Declare properties for React props and methods for the native ref. Nitrogen
 * generates the renderable component, its props type, and its ref type.
 * Fabric creates the native view when React renders the generated component.
 *
 * @example
 * ```ts
 * export declare class ScrollView extends HybridView {
 *   horizontal: boolean
 *   onScroll?: (offset: number) => void
 *   scrollTo(offset: number): void
 * }
 *
 * export * from '#nitro/ScrollView'
 * ```
 */
export declare abstract class HybridView extends HybridObject {
  protected constructor()
}
