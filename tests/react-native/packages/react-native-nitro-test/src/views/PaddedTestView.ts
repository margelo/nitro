import {
  getHostComponent,
  type HybridViewMethods,
} from 'react-native-nitro-modules'
import PaddedTestViewConfig from '../../nitrogen/generated/shared/json/PaddedTestViewConfig.json'
import type { PaddedTestViewProps } from '../specs/PaddedTestView.nitro'

export const PaddedTestView = getHostComponent<
  PaddedTestViewProps,
  HybridViewMethods
>('PaddedTestView', () => PaddedTestViewConfig)
