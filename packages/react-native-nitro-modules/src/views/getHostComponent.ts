import type { ReactNode } from 'react'
import { Platform, type HostComponent, type ViewProps } from 'react-native'
// TODO: Migrate to the official export of `NativeComponentRegistry` from `react-native` once react-native 0.83.0 becomes more established as this is deprecated
// eslint-disable-next-line @react-native/no-deep-imports
import * as NativeComponentRegistry from 'react-native/Libraries/NativeComponent/NativeComponentRegistry'
import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from './HybridView'

type AttributeValue<T, V = T> =
  | boolean
  | {
      diff?: (arg1: T, arg2: T) => boolean
      process?: (arg1: V) => T
    }

export interface ViewConfig<Props> {
  uiViewClassName: string
  supportsRawText?: boolean
  bubblingEventTypes: Record<string, unknown>
  directEventTypes: Record<string, unknown>
  validAttributes: {
    [K in keyof Props]: AttributeValue<Props[K]>
  }
}
type ReactNativeViewConfig = ReturnType<
  Parameters<typeof NativeComponentRegistry.get>[1]
>

function typesafe<Props>(config: ViewConfig<Props>): ReactNativeViewConfig {
  // TODO: Remove this unsafe cast and make it safe
  return config as ReactNativeViewConfig
}

/**
 * Represents all default props a Nitro HybridView has.
 */
interface DefaultHybridViewProps<RefType> {
  /**
   * A `ref` to the {@linkcode HybridObject} this Hybrid View is rendering.
   *
   * The `hybridRef` property expects a stable Ref object received from `useRef` or `createRef`.
   * @example
   * ```jsx
   * function App() {
   *   return (
   *     <HybridScrollView
   *       hybridRef={callback((ref) => {
   *         ref.current.scrollTo(400)
   *       })}
   *     />
   *   )
   * }
   * ```
   * @note If you're wondering about the `callback(...)` syntax, see
   * ["Callbacks have to be wrapped"](https://nitro.margelo.com/docs/guides/view-components#callbacks-have-to-be-wrapped).
   */
  hybridRef?: (ref: RefType) => void
}

/**
 * Wraps a callback function in a Nitro-compatible object format.
 *
 * @note Due to a React limitation, functions cannot be passed to native directly
 * because RN converts them to booleans (`true`). As a workaround,
 * Nitro requires you to wrap each function using `callback(...)`,
 * which bypasses React Native's conversion.
 * Please see the [Callbacks have to be wrapped](https://nitro.margelo.com/docs/guides/view-components#callbacks-have-to-be-wrapped) section for more information.
 *
 * @type {Object} NitroViewWrappedCallback
 * @property {T} f - The wrapped callback function
 */
export type NitroViewWrappedCallback<T extends Function | undefined> = { f: T }

// Due to a React limitation, functions cannot be passed to native directly
// because RN converts them to booleans (`true`). Nitro knows this and just
// wraps functions as objects - the original function is stored in `f`.
type WrapFunctionsInObjects<Props> = {
  [K in keyof Props]: Props[K] extends Function
    ? NitroViewWrappedCallback<Props[K]>
    : Props[K] extends Function | undefined
      ? NitroViewWrappedCallback<Props[K]>
      : Props[K]
}

/**
 * Resolves the `children` prop of a Nitro View.
 *
 * A Nitro View only accepts React children if its spec opted in by declaring a
 * `children` prop of type `HybridViewChildren`. Views that didn't opt
 * in get `children?: never`, which turns passing children into a compile error
 * instead of a silently invisible view on iOS and a crash on Android.
 */
type ChildrenPropOf<Props> = 'children' extends keyof Props
  ? { children?: ReactNode }
  : {
      /**
       * This Nitro View cannot render React children.
       *
       * To render children inside it, declare a `children` prop of type
       * `HybridViewChildren` in its Nitro spec.
       */
      children?: never
    }

/**
 * Represents a React Native view, implemented as a Nitro View, with the given props and methods.
 *
 * @note Every React Native view has a {@linkcode DefaultHybridViewProps.hybridRef hybridRef} which can be used to gain access
 *       to the underlying Nitro {@linkcode HybridView}.
 * @note Every function/callback is wrapped as a `{ f: … }` object. Use {@linkcode callback | callback(...)} for this.
 * @note Every method can be called on the Ref. Including setting properties directly.
 * @note `children` is only accepted if the Nitro View declared a `children` prop of type `HybridViewChildren`.
 */
export type ReactNativeView<
  Props extends HybridViewProps,
  Methods extends HybridViewMethods,
> = HostComponent<
  // `children` is a React concept, never a Nitro prop - it is neither wrapped as
  // a callback object nor a member of the underlying Hybrid Object.
  WrapFunctionsInObjects<
    DefaultHybridViewProps<Omit<HybridView<Props, Methods>, 'children'>> &
      Omit<Props, 'children'>
  > &
    Omit<ViewProps, 'children'> &
    ChildrenPropOf<Props>
>

type ValidAttributes<Props> = ViewConfig<Props>['validAttributes']
/**
 * Wraps all valid attributes of {@linkcode TProps} using Nitro's
 * default `diff` and `process` functions.
 */
function wrapValidAttributes<TProps>(
  attributes: ValidAttributes<TProps>
): ValidAttributes<TProps> {
  const keys = Object.keys(attributes) as (keyof ValidAttributes<TProps>)[]
  for (const key of keys) {
    attributes[key] = {
      diff: (a, b) => a !== b,
      process: (i) => i,
    }
  }
  return attributes
}

/**
 * Finds and returns a native view (aka "HostComponent") via the given {@linkcode name}.
 *
 * The view is bridged to a native Hybrid Object using Nitro Views.
 */
export function getHostComponent<
  Props extends HybridViewProps,
  Methods extends HybridViewMethods,
>(
  name: string,
  getViewConfig: () => ViewConfig<Props>
): ReactNativeView<Props, Methods> {
  if (NativeComponentRegistry == null) {
    throw new Error(
      `NativeComponentRegistry is not available on ${Platform.OS}!`
    )
  }
  return NativeComponentRegistry.get(name, () => {
    const config = getViewConfig()
    config.validAttributes = wrapValidAttributes(config.validAttributes)
    return typesafe(config)
  })
}
