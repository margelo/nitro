import { NitroConfig } from '../../config/NitroConfig.js'
import { createFileMetadataString, isCppFile, isNotDuplicate } from '../../syntax/helpers.js'
import { getPlatformDirectory, type SourceFile } from '../../syntax/SourceFile.js'
import { indent } from '../../utils.js'

export function createCMakeExtension(files: SourceFile[]): Omit<SourceFile, 'language'> & { language: 'cmake' } {
  const config = NitroConfig.current
  const name = config.getAndroidCxxLibName()
  const isReactNative = config.getRuntimePackageName() === 'react-native-nitro-modules'
  const core = isReactNative ? 'react-native-nitro-modules' : 'nitro-core'
  const cppSources = files.filter((file) => file.platform !== 'ios' && isCppFile(file))
  const paths = cppSources.map((file) => {
    const relativePath = [getPlatformDirectory(file.platform), file.language, ...file.subdirectory, file.name].join('/')
    return `"\${CMAKE_CURRENT_LIST_DIR}/../${relativePath}"`
  })
  const sources = paths.filter(isNotDuplicate).sort()
  let reactNativePackage: string
  let reactNativeLibraries: string
  let reactNativeDefinitions: string
  if (isReactNative) {
    reactNativePackage = 'find_package(ReactAndroid REQUIRED CONFIG)'
    reactNativeLibraries = `
ReactAndroid::jsi
ReactAndroid::reactnative
`.trim()
    reactNativeDefinitions = `
# Match React Native's ReactAndroid/cmake-utils/folly-flags.cmake.
target_compile_definitions(${name} PRIVATE
  RN_SERIALIZABLE_STATE
  FOLLY_NO_CONFIG=1
  FOLLY_HAVE_CLOCK_GETTIME=1
  FOLLY_USE_LIBCPP=1
  FOLLY_CFG_NO_COROUTINES=1
  FOLLY_MOBILE=1
  FOLLY_HAVE_RECVMMSG=1
  FOLLY_HAVE_PTHREAD=1
  FOLLY_HAVE_XSI_STRERROR_R=1
)
`.trim()
  } else {
    reactNativePackage = ''
    reactNativeLibraries = ''
    reactNativeDefinitions = ''
  }
  const code = `
${createFileMetadataString(`${name}+autolinking.cmake`, '#')}

target_compile_features(${name} PUBLIC cxx_std_20)
target_include_directories(${name} PRIVATE
  "\${CMAKE_CURRENT_LIST_DIR}/../shared/c++/include"
  "\${CMAKE_CURRENT_LIST_DIR}/c++/include"
  "\${CMAKE_CURRENT_LIST_DIR}/include"
)
target_sources(${name} PRIVATE
  "\${CMAKE_CURRENT_LIST_DIR}/${name}OnLoad.cpp"
  ${indent(sources.join('\n'), '  ')}
)

find_package(fbjni REQUIRED CONFIG)
find_package(${core} REQUIRED CONFIG)
${reactNativePackage}
target_link_libraries(${name}
  fbjni::fbjni
  ${core}::NitroModules
  ${indent(reactNativeLibraries, '  ')}
)
${reactNativeDefinitions}
`.trim()
  return {
    language: 'cmake',
    name: `${name}+autolinking.cmake`,
    platform: 'android',
    subdirectory: [],
    content: code,
  }
}
