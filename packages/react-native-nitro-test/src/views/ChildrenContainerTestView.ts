import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
import ChildrenContainerTestViewConfig from '../../nitrogen/generated/shared/json/ChildrenContainerTestViewConfig.json'
import {
  type ChildrenContainerTestViewMethods,
  type ChildrenContainerTestViewProps,
} from '../specs/ChildrenContainerTestView.nitro'

/**
 * Represents the HybridView `ChildrenContainerTestView`, which renders React
 * children into a sub-view of its `view` via `childrenContainer`.
 */
export const ChildrenContainerTestView = getHostComponent<
  ChildrenContainerTestViewProps,
  ChildrenContainerTestViewMethods
>('ChildrenContainerTestView', () => ChildrenContainerTestViewConfig)

export type ChildrenContainerTestViewRef = HybridRef<
  ChildrenContainerTestViewProps,
  ChildrenContainerTestViewMethods
>
