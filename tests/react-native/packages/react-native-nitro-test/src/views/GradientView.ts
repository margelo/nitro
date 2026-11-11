import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
import GradientViewConfig from '../../nitrogen/generated/shared/json/GradientViewConfig.json'
import {
  type GradientViewMethods,
  type GradientViewProps,
} from '../specs/GradientView.nitro'

export const GradientView = getHostComponent<
  GradientViewProps,
  GradientViewMethods
>('GradientView', () => GradientViewConfig)

export type GradientViewRef = HybridRef<GradientViewProps, GradientViewMethods>
