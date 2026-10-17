import {
  androidPlatform,
  androidEmulator,
} from '@react-native-harness/platform-android'
import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple'
import { runningTestPlugin } from './harness-running-test-plugin.mjs'

const config = {
  entryPoint: './index.js',
  appRegistryComponentName: 'NitroExample',

  runners: [
    androidPlatform({
      name: 'android',
      device: androidEmulator(process.env.AVD_NAME, {
        apiLevel: Number(process.env.DEVICE_API_LEVEL),
        profile: process.env.DEVICE_PROFILE,
        diskSize: process.env.AVD_DISK_SIZE,
        heapSize: process.env.AVD_HEAP_SIZE,
        snapshot: {
          enabled: process.env.CI === 'true',
        },
      }),
      bundleId: 'com.margelo.nitroexample',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator(process.env.DEVICE_MODEL, process.env.IOS_VERSION),
      bundleId: 'com.margelo.nitro.example',
    }),
  ],
  defaultRunner: 'android',
  plugins: [runningTestPlugin()],
  resetEnvironmentBetweenTestFiles: 'runtime',
  // View cases perform several render/recycling steps and native screenshots.
  testTimeout: process.env.CI === 'true' ? 30000 : 10000,
  platformReadyTimeout: process.env.CI === 'true' ? 420000 : 300000,
  bridgeTimeout: process.env.CI === 'true' ? 180000 : 60000,
  bundleStartTimeout: process.env.CI === 'true' ? 120000 : 60000,
}

export default config
