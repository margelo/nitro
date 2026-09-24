import type { HybridObject } from './HybridObject'
import { NitroModules } from './NitroModules'

const cache = new Map<string, Function>()

/**
 * Get a constructor function for the given `HybridObject` {@linkcode T}.
 * @param name The name of the `HybridObject` under which it was registered at.
 * @returns A constructor that creates instances of {@linkcode T}
 * @example
 * ```ts
 * export const HybridImage = getHybridObjectConstructor<Image>('Image')
 *
 * const image1 = new HybridImage()
 * const image2 = new HybridImage()
 * image1 instanceof HybridImage // --> true
 * ```
 */
export function getHybridObjectConstructor<T extends HybridObject<{}>>(
  name: string
): { new (): T } {
  // Cache functions for performance.
  if (cache.has(name)) {
    return cache.get(name) as { new (): T }
  }

  // A function that creates the HybridObject.
  // This can be called with `new`, and internally sets the prototype.
  const constructorFunc = function () {
    const instance = NitroModules.createHybridObject<T>(name)
    const prototype = Object.getPrototypeOf(instance)
    if (constructorFunc.prototype !== prototype) {
      constructorFunc.prototype = prototype
      constructorFunc.prototypeInitialized = true
    }
    return instance
  } as unknown as { new (): T } & { prototypeInitialized?: boolean }

  // Configure lazy prototype. If `instanceof` is called before a `T`
  // has been created, we just lazy-create a new `T` instance to set the proto.
  constructorFunc.prototypeInitialized = false
  Object.defineProperty(constructorFunc, Symbol.hasInstance, {
    value: (instance: unknown) => {
      if (
        instance == null ||
        (typeof instance !== 'object' && typeof instance !== 'function')
      ) {
        return false
      }

      if (!constructorFunc.prototypeInitialized) {
        // User didn't call `new T()` yet, so we don't
        // know the prototype yet. Just create one temp object to find
        // out the prototype.
        const tempInstance = NitroModules.createHybridObject<T>(name)
        constructorFunc.prototype = Object.getPrototypeOf(tempInstance)
        constructorFunc.prototypeInitialized = true
      }
      // Loop through the prototype chain of the value
      // we're testing for to see if it is a direct instance
      // of `T`, or a derivative of it.
      let proto = Object.getPrototypeOf(instance)
      while (proto != null) {
        if (proto === constructorFunc.prototype) {
          return true
        }
        proto = Object.getPrototypeOf(proto)
      }
      // No prototype overlap.
      return false
    },
  })

  cache.set(name, constructorFunc)
  return constructorFunc
}
