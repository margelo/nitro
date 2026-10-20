// Publish in dependency order. Every package belongs to the same release.
export const releasePackages = [
  'nitro-core',
  'nitrogen',
  'react-native-nitro-modules',
]

export const versionedManifests = [
  'package.json',
  ...releasePackages.map((name) => `packages/${name}/package.json`),
  'tests/react-native/packages/react-native-nitro-test/package.json',
  'tests/react-native/packages/react-native-nitro-test-external/package.json',
  'tests/react-native/apps/example/package.json',
  'tests/react-native/apps/benchmark/package.json',
]

export const versionedSources = [
  'packages/nitro-core/native/cpp/include/NitroModules/NitroDefines.hpp',
  'packages/nitro-core/js/src/version.ts',
]

export const versionedFiles = [
  ...versionedManifests,
  ...versionedSources,
  'bun.lock',
]
