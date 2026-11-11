import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules'

export interface RecyclableTestViewProps extends HybridViewProps {
  isBlue: boolean
  nativeDefaultValue?: number
}
export interface RecyclableTestViewMethods extends HybridViewMethods {
  getInvalidLifecycleOrderCount(): number
  getOnDropViewCount(): number
  getPrepareForRecycleCount(): number
  getNativeDefaultValueSetterCallCount(): number
}

export type RecyclableTestView = HybridView<
  RecyclableTestViewProps,
  RecyclableTestViewMethods
>
