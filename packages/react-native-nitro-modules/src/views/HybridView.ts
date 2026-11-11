import type { HybridObject } from 'nitro-core'

/**
 * Describes the languages this view will be implemented in.
 */
export interface ViewPlatformSpec {
  ios?: 'swift'
  android?: 'kotlin'
}

/**
 * Represents props for a Hybrid View.
 * Such props are implemented on the native side, and can be
 * set from JS using React props.
 * @example
 * ```ts
 * // Definition:
 * type Direction = 'horizontal' | 'vertical'
 * interface ScrollViewProps extends HybridViewProps {
 *   direction: Direction
 * }
 * export type ScrollView = HybridView<ScrollViewProps>
 *
 * // in React:
 * function App() {
 *   return <HybridScrollView direction="vertical" />
 * }
 * ```
 */
export interface HybridViewProps {
  /* no default props */
}

/**
 * Represents methods for a Hybrid View.
 * Such methods are implemented on the native side, and can be
 * called from JS using the `hybridRef`.
 * @example
 * ```ts
 * // Definition:
 * interface ScrollViewProps extends HybridViewProps { … }
 * interface ScrollViewMethods extends HybridViewMethods {
 *   scrollTo(y: number): void
 * }
 * export type ScrollView = HybridView<ScrollViewProps, ScrollViewMethods>
 *
 * // in React:
 * function App() {
 *   const ref = useRef<ScrollView>(null)
 *   useLayoutEffect(() => {
 *     ref.current.scrollTo(400)
 *   }, [])
 *   return <HybridScrollView hybridRef={ref} />
 * }
 * ```
 */
export interface HybridViewMethods {}

/**
 * The type of a {@linkcode DefaultHybridViewProps.hybridRef hybridRef}.
 * @example
 * ```ts
 * // declaration:
 * interface ScrollViewProps extends HybridViewProps { … }
 * interface ScrollViewMethods extends HybridViewMethods {
 *   scrollTo(y: number): void
 * }
 * export type ScrollView = HybridView<ScrollViewProps, ScrollViewMethods>
 * export type ScrollViewRef = HybridRef<ScrollViewProps, ScrollViewMethods>
 *
 * // in react:
 * function App() {
 *   const ref = useRef<ScrollViewRef>(null)
 *   useLayoutEffect(() => {
 *     ref.current.scrollTo(400)
 *   }, [])
 *   return <ScrollView hybridRef={ref} />
 * }
 * ```
 */
export type HybridRef<
  Props extends HybridViewProps,
  Methods extends HybridViewMethods = {},
  Platforms extends ViewPlatformSpec = { ios: 'swift'; android: 'kotlin' },
> = HybridObject<Platforms> & Props & Methods

/**
 * This interface acts as a tag for Hybrid Views so nitrogen detects them.
 */
interface HybridViewTag<
  Platforms extends ViewPlatformSpec,
> extends HybridObject<Platforms> {}

/**
 * Represents a Nitro Hybrid View.
 *
 * The Hybrid View's implementation is in native iOS or Android, and is backed
 * by a {@linkcode HybridObject}.
 *
 * Each view has {@linkcode HybridViewProps}, and can optionally also
 * have custom {@linkcode HybridViewMethods}.
 *
 * Properties can be set using React props, and methods can be called after obtaining
 * a reference to the {@linkcode HybridObject} via {@linkcode DefaultHybridViewProps.hybridRef hybridRef}.
 *
 * The view can be rendered in React (Native).
 * @example
 * ```ts
 * interface ScrollViewProps extends HybridViewProps { … }
 * interface ScrollViewMethods extends HybridViewMethods { … }
 * export type ScrollView = HybridView<ScrollViewProps, ScrollViewMethods>
 * ```
 */
export type HybridView<
  Props extends HybridViewProps,
  Methods extends HybridViewMethods = {},
  Platforms extends ViewPlatformSpec = { ios: 'swift'; android: 'kotlin' },
> = HybridViewTag<Platforms> & HybridObject<Platforms> & Props & Methods
