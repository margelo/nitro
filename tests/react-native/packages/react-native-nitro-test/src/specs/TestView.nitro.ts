import { Android, Apple, type HybridView, type Int64 } from 'react-native-nitro-modules'

export type ColorScheme = 'light' | 'dark'

@Apple({
  language: 'swift',
  implementation: { className: 'HybridTestView' },
})
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridTestView' },
})
export declare class TestView extends HybridView {
  isBlue: boolean
  hasBeenCalled: boolean
  int64Value: Int64
  colorScheme: ColorScheme
  someCallback: () => void
  nativeDefaultValue?: number

  getIsViewBlue(view: TestView): boolean
  getOnDropViewCount(): number
  getIsBlueSetterCallCount(): number
  getNativeDefaultValueSetterCallCount(): number
  someMethod(): void
}

export * from '#nitro/TestView'
