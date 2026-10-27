import type { HybridViewMethods, HybridViewProps } from './HybridView'
import type { ReactNativeView, ViewConfig } from './getHostComponent'

export type {
  NitroViewWrappedCallback,
  ReactNativeView,
  ViewConfig,
} from './getHostComponent'

/**
 * Nitro Views are native-only and cannot create a HostComponent on web.
 */
export function getHostComponent<
  Props extends HybridViewProps,
  Methods extends HybridViewMethods,
>(
  name: string,
  _getViewConfig: () => ViewConfig<Props>
): ReactNativeView<Props, Methods> {
  throw new Error(`Nitro View "${name}" is not supported on web`)
}
