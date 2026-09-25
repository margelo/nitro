import { Platform } from 'react-native'
import type { HybridViewMethods, HybridViewProps } from './HybridView'
import type {
  NitroViewWrappedCallback,
  ReactNativeView,
  ViewConfig,
} from './getHostComponent'

/**
 * Nitro Views are backed by native iOS/Android views, so they cannot be rendered on web.
 *
 * This file exists so web bundles never resolve `getHostComponent.ts`, which deep-imports
 * React Native's internal `NativeComponentRegistry` and thereby pulls native-only React
 * Native code into a web bundle.
 */
export function getHostComponent<
  Props extends HybridViewProps,
  Methods extends HybridViewMethods,
>(
  name: string,
  _getViewConfig: () => ViewConfig<Props>
): ReactNativeView<Props, Methods> {
  throw new Error(
    `Nitro Views are not supported on ${Platform.OS}! ("${name}" cannot be rendered here)`
  )
}

/**
 * Wrap the given {@linkcode func} in a Nitro callback.
 * - For older versions of react-native, this wraps the callback in a `{ f: T }` object.
 * - For newer versions of react-native, this just returns the function as-is.
 */
export function callback<T>(
  func: T
): T extends (...args: any[]) => any ? NitroViewWrappedCallback<T> : T
export function callback(func: unknown) {
  if (typeof func === 'function') {
    return { f: func }
  }
  return func
}
