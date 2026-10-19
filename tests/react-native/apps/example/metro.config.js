const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')
const pak = require('../../../../packages/react-native-nitro-modules/package.json')

const root = path.resolve(__dirname, '../../../..')
const modules = Object.keys({ ...pak.peerDependencies })

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],

  // Resolve peer dependencies from this app so Metro loads one copy of each.
  resolver: {
    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.dirname(
        require.resolve(`${name}/package.json`, { paths: [__dirname] })
      )
      return acc
    }, {}),
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
