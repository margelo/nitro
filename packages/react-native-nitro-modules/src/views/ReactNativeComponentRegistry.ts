import {
  // @ts-expect-error This was shipped in react-native 0.82 but doesn't have types yet
  NativeComponentRegistry as newRegistry,
  type HostComponent,
} from 'react-native'

interface RegistryType {
  get<P>(name: string, getConfig: () => object): HostComponent<P>
}

const registry: RegistryType | undefined =
  newRegistry ??
  // eslint-disable-next-line @react-native/no-deep-imports
  require('react-native/Libraries/NativeComponent/NativeComponentRegistry')

/**
 * `NativeComponentRegistry` from react-native core
 */
export const ReactNativeComponentRegistry = registry
