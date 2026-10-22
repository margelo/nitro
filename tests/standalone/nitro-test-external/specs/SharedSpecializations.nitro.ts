import { Android, iOS } from 'nitro-core'
import type { HybridObject, Inline } from 'nitro-core'

export * from '#nitro/SharedSpecializationsCpp'
export * from '#nitro/SharedSpecializations'

/**
 * Uses the same Promise and Callback specializations as `nitro-test`, such as
 * `Promise<void>` and `(value: number) => void`. Both generated modules then
 * bridge the same C++ types, and `nitro-test` imports this module.
 *
 * The C++ and Swift/Kotlin implementations share one surface so the shared
 * cases run against every implementation language in both modules.
 */
@iOS({
  language: 'c++',
  implementation: {
    className: 'HybridSharedSpecializationsCpp',
    include: '"HybridSharedSpecializationsCpp.hpp"',
  },
})
@Android({
  language: 'c++',
  implementation: {
    className: 'HybridSharedSpecializationsCpp',
    include: '"HybridSharedSpecializationsCpp.hpp"',
  },
})
export declare class SharedSpecializationsCpp extends HybridObject {
  constructor()

  // Promises
  resolveVoid(): Promise<void>
  resolveNumber(value: number): Promise<number>
  resolveString(value: string): Promise<string>
  awaitVoid(promise: Promise<void>): Promise<void>
  awaitNumber(promise: Promise<number>): Promise<number>

  // Callbacks
  callVoid(callback: () => void): void
  callWithNumber(value: number, callback: (value: number) => void): void
  callWithString(value: string, callback: (value: string) => void): void
  mapNumber(value: number, callback: (value: number) => number): Promise<number>
  wrapNumberCallback(callback: (value: number) => void): (value: number) => void
  callVoidPromiseCallback(callback: () => Promise<void>): Promise<void>
  callNumberPromiseCallback(callback: () => Promise<number>): Promise<number>
  numberCallback: (value: number) => void

  // Inline callbacks
  callInline(callback: Inline<() => void>): void
  callInlineWithNumber(value: number, callback: Inline<(value: number) => number>): number
}

@iOS({
  language: 'swift',
  implementation: { className: 'HybridSharedSpecializations' },
})
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridSharedSpecializations' },
})
export declare class SharedSpecializations extends HybridObject {
  constructor()

  // Promises
  resolveVoid(): Promise<void>
  resolveNumber(value: number): Promise<number>
  resolveString(value: string): Promise<string>
  awaitVoid(promise: Promise<void>): Promise<void>
  awaitNumber(promise: Promise<number>): Promise<number>

  // Callbacks
  callVoid(callback: () => void): void
  callWithNumber(value: number, callback: (value: number) => void): void
  callWithString(value: string, callback: (value: string) => void): void
  mapNumber(value: number, callback: (value: number) => number): Promise<number>
  wrapNumberCallback(callback: (value: number) => void): (value: number) => void
  callVoidPromiseCallback(callback: () => Promise<void>): Promise<void>
  callNumberPromiseCallback(callback: () => Promise<number>): Promise<number>
  numberCallback: (value: number) => void

  // Inline callbacks
  callInline(callback: Inline<() => void>): void
  callInlineWithNumber(value: number, callback: Inline<(value: number) => number>): number
}
