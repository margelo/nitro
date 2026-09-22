import type {
  HybridView,
  HybridViewChildren,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules'

export interface ChildrenContainerTestViewProps extends HybridViewProps {
  children?: HybridViewChildren
  isBlue: boolean
}
export interface ChildrenContainerTestViewMethods extends HybridViewMethods {
  /**
   * The number of child Views mounted into this View's `childrenContainer`,
   * which is a sub-view of `view` rather than `view` itself.
   */
  getNativeChildCount(): number
  /**
   * The number of children `view` itself holds - always 1, the container.
   */
  getViewChildCount(): number
}

export type ChildrenContainerTestView = HybridView<
  ChildrenContainerTestViewProps,
  ChildrenContainerTestViewMethods
>
