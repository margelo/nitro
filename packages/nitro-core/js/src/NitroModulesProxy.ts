import type { HybridObject } from './HybridObject.js'
import type { BoxedHybridObject } from './BoxedHybridObject.js'
import { NitroModules } from './NitroModules.js'

declare class NitroModulesProxy extends HybridObject {
  /**
   * The native runtime creates this singleton during installation.
   */
  private constructor()

  /**
   * Returns the registered class and its shared prototype in this runtime.
   * Generated classes use their `nitro.json` namespace as a dot-separated prefix,
   * for example `image.Image`. The constructor's `name` remains `Image`.
   * Nitrogen's generated exports provide the class type automatically.
   * Classes without a public constructor can still be used with `instanceof`.
   */
  getHybridClass<T extends { readonly prototype: HybridObject }>(
    name: string
  ): T
  /**
   * Returns whether a HybridObject class is registered under the given {@linkcode name}.
   */
  hasHybridClass(name: string): boolean
  /**
   * Returns whether the given {@linkcode object} is a {@linkcode HybridObject}, or not.
   */
  isHybridObject(object: object): object is HybridObject
  /**
   * Gets the names of all registered HybridObject classes.
   */
  getAllHybridClassNames(): string[]

  /**
   * Gets the current build type configuration as defined in the `NITRO_DEBUG`
   * preprocessor flag.
   */
  buildType: 'debug' | 'release'
  /**
   * Gets the native Nitro Modules core runtime version that this app is built with.
   * This should be kept in sync with the JS version (package.json), otherwise it could
   * introduce undefined behaviour.
   */
  version: string

  /**
   * Boxes the given {@linkcode hybridObject} into a {@linkcode BoxedHybridObject<T>}, which can
   * later be unboxed in a separate Runtime.
   *
   * While Nitro is runtime-agnostic and all `HybridObject`s can be used from a any Runtime,
   * some threading/worklet libraries (like [react-native-worklets-core](https://github.com/margelo/react-native-worklets-core))
   * do not yet support copying over `HybridObject`s as they use newer JSI APIs like `jsi::NativeState`.
   *
   * While those APIs are not yet available, you can still use every Nitro Hybrid Object in a separate
   * Runtime/Worklet context by just boxing it yourself:
   *
   * @example
   * ```ts
   * import { Something } from './Something.nitro.js'
   *
   * const something = new Something()
   * const boxed = NitroModules.box(something)
   * const context = Worklets.createContext('DummyContext')
   * context.runAsync(() => {
   *   'worklet'
   *   const unboxed = boxed.unbox()
   *   console.log(unboxed.toString()) // --> "[HybridObject Something]"
   * })
   * ```
   */
  box<T extends HybridObject>(obj: T): BoxedHybridObject<T>

  /**
   * Returns whether the given {@linkcode object} has NativeState or not.
   */
  hasNativeState(object: unknown): boolean

  /**
   * Re-calculates `memorySize` of the given {@linkcode HybridObject} and notifies
   * the JS VM about the newly updated memory footprint.
   *
   * This is achieved by just doing a round-trip from JS -> native -> JS.
   */
  updateMemorySize<T extends HybridObject>(obj: T): T

  /**
   * Allocate a new native {@linkcode ArrayBuffer} with the
   * given {@linkcode size}.
   *
   * As opposed to creating an {@linkcode ArrayBuffer} from JS,
   * this method returns a buffer that can be directly read from
   * and written to in Nitro Modules without copying, as native
   * owns it - not JS.
   */
  createNativeArrayBuffer(size: number): ArrayBuffer

  /**
   * Gets a total number of currently allocated {@linkcode HybridObject}s.
   * @internal
   */
  debug_getTotalAllocatedHybridObjects(): number
}

/**
 * The native class of the {@linkcode NitroModules} singleton.
 * Native installation creates the instance before JavaScript runs.
 *
 * @example
 * ```ts
 * import { NitroModules, NitroModulesProxy } from 'nitro-core'
 *
 * NitroModules instanceof NitroModulesProxy // true
 * NitroModules.getHybridClass('core.Performance')
 * ```
 */
const NativeNitroModulesProxy: typeof NitroModulesProxy =
  NitroModules.getHybridClass('NitroModulesProxy')
type NativeNitroModulesProxy = NitroModulesProxy

export { NativeNitroModulesProxy as NitroModulesProxy }
