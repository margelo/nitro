import { iOS, type HybridView } from 'react-native-nitro-modules'

@iOS({
  language: 'swift',
  implementation: { className: 'HybridTestView' },
})
export declare class TestView extends HybridView {
  isBlue: boolean
  someCallback: () => void

  someMethod(): void
  getModuleName(): string
}

export * from '#nitro/TestView'
