import {
  androidPlatform,
  physicalAndroidDevice,
} from '@react-native-harness/platform-android'
import baselineConfig from './rn-harness.baseline.config.mjs'

const device = physicalAndroidDevice(
  process.env.REDROID_MANUFACTURER,
  process.env.REDROID_MODEL
)
const runner = androidPlatform({
  name: 'android',
  device,
  bundleId: 'com.margelo.nitroexample',
})

export default {
  ...baselineConfig,
  runners: [runner],
}
