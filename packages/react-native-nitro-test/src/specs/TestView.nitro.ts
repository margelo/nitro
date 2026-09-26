import type {
  HybridView as HybridViewAlias,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules'

export type ColorScheme = 'light' | 'dark'

export interface TestViewProps extends HybridViewProps {
  isBlue: boolean
  hasBeenCalled: boolean
  colorScheme: ColorScheme
  someCallback: () => void
  nativeDefaultValue?: number
}
export interface TestViewMethods extends HybridViewMethods {
  getOnDropViewCount(): number
  getIsBlueSetterCallCount(): number
  getNativeDefaultValueSetterCallCount(): number
  someMethod(): void
}

export type TestView = HybridViewAlias<TestViewProps, TestViewMethods>
