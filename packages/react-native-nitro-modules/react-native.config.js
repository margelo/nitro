// https://github.com/react-native-community/cli/blob/main/docs/dependencies.md

module.exports = {
  dependency: {
    platforms: {
      /**
       * @type {import('@react-native-community/cli-types').IOSDependencyParams}
       */
      ios: {},
      /**
       * @type {import('@react-native-community/cli-types').AndroidDependencyParams}
       */
      android: {},
      windows: {
        sourceDir: 'windows',
        projects: [
          {
            projectFile: 'NitroModules\\NitroModules.vcxproj',
            directDependency: true,
            cppHeaders: ['NitroModules/ReactPackageProvider.h'],
            cppPackageProviders: ['NitroModules::ReactPackageProvider'],
          },
        ],
      },
    },
  },
}
