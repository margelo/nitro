import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
import TestViewConfig from '../../nitrogen/generated/shared/json/TestViewConfig.json'
import {
  type TestViewMethods,
  type TestViewProps,
} from '../specs/TestView.nitro'

/**
 * Represents the HybridView `TestView`, which can be rendered as a React Native view.
 */
export const TestView = getHostComponent<TestViewProps, TestViewMethods>(
  'TestView',
  () => TestViewConfig
)

export type TestViewRef = HybridRef<TestViewProps, TestViewMethods>
