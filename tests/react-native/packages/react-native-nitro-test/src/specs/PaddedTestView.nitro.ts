import { Android, Apple, type HybridView } from 'react-native-nitro-modules'

@Apple({ language: 'swift', implementation: { className: 'HybridPaddedTestView' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridPaddedTestView' } })
export declare class PaddedTestView extends HybridView {}

export * from '#nitro/PaddedTestView'
