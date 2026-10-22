import { Android, Apple, type HybridView } from 'react-native-nitro-modules'

@Apple({
  language: 'swift',
  implementation: { className: 'HybridRecyclableTestView' },
})
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridRecyclableTestView' },
})
export declare class RecyclableTestView extends HybridView {
  isBlue: boolean
  nativeDefaultValue?: number

  getInvalidLifecycleOrderCount(): number
  getOnDropViewCount(): number
  getPrepareForRecycleCount(): number
  getNativeDefaultValueSetterCallCount(): number
}

export * from '#nitro/RecyclableTestView'
