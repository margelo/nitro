// Fixed operations per sample, sized from GitHub run 34125332141, attempt 1.
// Counts are shared by base and head. Retune explicitly when the case or testbed changes.
const iterations: Readonly<Record<string, { android: number; ios: number }>> = {
  'javascript/control/add-numbers': { android: 2_600_000, ios: 3_000_000 },
  'turbo-module/control/add-numbers': { android: 280_000, ios: 100_000 },
  'nitro-cpp/primitive/simple-func': { android: 1_100_000, ios: 980_000 },
  'nitro-cpp/primitive/add-numbers': { android: 830_000, ios: 740_000 },
  'nitro-cpp/property/number-get-set': { android: 560_000, ios: 480_000 },
  'nitro-cpp/string/ascii-short': { android: 540_000, ios: 590_000 },
  'nitro-cpp/string/unicode': { android: 270_000, ios: 290_000 },
  'nitro-cpp/array/small-16': { android: 88_000, ios: 90_000 },
  'nitro-cpp/array/large-1024': { android: 1_800, ios: 1_800 },
  'nitro-cpp/struct/nested-car': { android: 34_000, ios: 33_000 },
  'nitro-cpp/map/typed-eight-entries': { android: 46_000, ios: 49_000 },
  'nitro-cpp/optional/trailing-string': { android: 540_000, ios: 440_000 },
  'nitro-cpp/variant/number-or-string': { android: 570_000, ios: 590_000 },
  'nitro-cpp/hybrid-object/create': { android: 150_000, ios: 170_000 },
  'nitro-cpp/hybrid-object/return-existing': { android: 390_000, ios: 390_000 },
  'nitro-cpp/array-buffer/bounce-4-kib': { android: 260_000, ios: 270_000 },
  'nitro-cpp/array-buffer/bounce-1-mib': { android: 260_000, ios: 310_000 },
  'nitro-cpp/array-buffer/bounce-native-4-kib': {
    android: 190_000,
    ios: 190_000,
  },
  'nitro-cpp/array-buffer/bounce-native-1-mib': {
    android: 22_000,
    ios: 23_000,
  },
  'nitro-cpp/array-buffer/copy-4-kib': { android: 110_000, ios: 71_000 },
  'nitro-cpp/array-buffer/copy-1-mib': { android: 4_600, ios: 1_100 },
  'nitro-cpp/callback/synchronous': { android: 330_000, ios: 350_000 },
  'nitro-cpp/promise/immediate': { android: 87_000, ios: 97_000 },
  'nitro-cpp/promise/deferred-worker-with-trigger': {
    android: 2_900,
    ios: 5_500,
  },
  'nitro-platform/primitive/simple-func': { android: 660_000, ios: 1_100_000 },
  'nitro-platform/primitive/add-numbers': { android: 570_000, ios: 900_000 },
  'nitro-platform/property/number-get-set': { android: 280_000, ios: 440_000 },
  'nitro-platform/string/ascii-short': { android: 160_000, ios: 470_000 },
  'nitro-platform/string/unicode': { android: 100_000, ios: 190_000 },
  'nitro-platform/array/small-16': { android: 66_000, ios: 62_000 },
  'nitro-platform/array/large-1024': { android: 1_600, ios: 1_200 },
  'nitro-platform/struct/nested-car': { android: 16_000, ios: 31_000 },
  'nitro-platform/map/typed-eight-entries': { android: 11_000, ios: 34_000 },
  'nitro-platform/optional/trailing-string': { android: 210_000, ios: 500_000 },
  'nitro-platform/variant/number-or-string': { android: 170_000, ios: 350_000 },
  'nitro-platform/hybrid-object/create': { android: 47_000, ios: 2_800 },
  'nitro-platform/hybrid-object/return-existing': {
    android: 120_000,
    ios: 300_000,
  },
  'nitro-platform/array-buffer/bounce-4-kib': { android: 84_000, ios: 230_000 },
  'nitro-platform/array-buffer/bounce-1-mib': { android: 82_000, ios: 290_000 },
  'nitro-platform/array-buffer/bounce-native-4-kib': {
    android: 66_000,
    ios: 230_000,
  },
  'nitro-platform/array-buffer/bounce-native-1-mib': {
    android: 18_000,
    ios: 23_000,
  },
  'nitro-platform/array-buffer/copy-4-kib': { android: 17_000, ios: 48_000 },
  'nitro-platform/array-buffer/copy-1-mib': { android: 320, ios: 870 },
  'nitro-platform/callback/synchronous': { android: 86_000, ios: 260_000 },
  'nitro-platform/promise/immediate': { android: 32_000, ios: 57_000 },
  'nitro-platform/promise/deferred-worker-with-trigger': {
    android: 2_100,
    ios: 5_200,
  },
}

export function getBenchmarkIterations(
  id: string,
  platform: 'android' | 'ios'
): number {
  const count = iterations[id]?.[platform]
  if (count == null)
    throw new Error(`Missing fixed iteration count for ${id} on ${platform}.`)
  return count
}
