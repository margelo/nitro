import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
import ChildrenTestViewConfig from '../../nitrogen/generated/shared/json/ChildrenTestViewConfig.json'
import {
  type ChildrenTestViewMethods,
  type ChildrenTestViewProps,
} from '../specs/ChildrenTestView.nitro'

/**
 * Represents the HybridView `ChildrenTestView`, which can be rendered as a
 * React Native view, and which renders React children.
 */
export const ChildrenTestView = getHostComponent<
  ChildrenTestViewProps,
  ChildrenTestViewMethods
>('ChildrenTestView', () => ChildrenTestViewConfig)

export type ChildrenTestViewRef = HybridRef<
  ChildrenTestViewProps,
  ChildrenTestViewMethods
>
