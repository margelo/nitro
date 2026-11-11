import type {
  HybridView,
  HybridViewProps,
  HybridViewMethods,
} from 'react-native-nitro-modules'

export interface GradientViewProps extends HybridViewProps {
  colors: string[]
}

export interface GradientViewMethods extends HybridViewMethods {}

export type GradientView = HybridView<GradientViewProps, GradientViewMethods>
