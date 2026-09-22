import type {
  HybridView,
  HybridViewChildren,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules'

export interface ChildrenTestViewProps extends HybridViewProps {
  /**
   * Opts this View into rendering React children - it is a marker, not a
   * native prop.
   */
  children?: HybridViewChildren
  isBlue: boolean
}
export interface ChildrenTestViewMethods extends HybridViewMethods {
  /**
   * The number of child Views React Native mounted into this View's native
   * container.
   */
  getNativeChildCount(): number
}

export type ChildrenTestView = HybridView<
  ChildrenTestViewProps,
  ChildrenTestViewMethods
>
