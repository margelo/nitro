import chalk from 'chalk'
import { readUserConfig } from './getConfig.js'
import type {
  AutolinkingAndroidImplementation,
  AutolinkingIOSImplementation,
  AutolinkingPlatformImplementation,
  AutolinkingWindowsImplementation,
  NitroUserConfig,
} from './NitroUserConfig.js'

const CXX_BASE_NAMESPACE = ['margelo', 'nitro']
const ANDROID_BASE_NAMESPACE = ['com', 'margelo', 'nitro']

/**
 * Represents the properly parsed `nitro.json` config of the current executing directory.
 */
export class NitroConfig {
  private readonly config: NitroUserConfig
  private static singleton: NitroConfig | undefined

  constructor(config: NitroUserConfig) {
    this.config = config
  }

  static get current(): NitroConfig {
    if (this.singleton == null) {
      console.log(
        chalk.reset(`🔧  Loading ${chalk.underline('nitro.json')} config...`)
      )
      const defaultConfigPath = './nitro.json'
      const config = readUserConfig(defaultConfigPath)
      this.singleton = new NitroConfig(config)
    }
    return this.singleton
  }

  /**
   * Returns the name of the Android C++ library (aka name in CMakeLists.txt `add_library(..)`).
   * This will be loaded via `System.loadLibrary(...)`.
   * @example `NitroTest`
   */
  getAndroidCxxLibName(): string {
    return this.config.android.androidCxxLibName
  }

  /**
   * Returns the iOS module name (aka Pod name) of the module that will be generated.
   * @example `NitroTest`
   */
  getIosModuleName(): string {
    return this.config.ios.iosModuleName
  }

  /**
   * Returns the Windows module name of the module that will be generated.
   * This is the `winrt::` namespace of the generated autolinking `ReactPackageProvider`.
   * Falls back to the iOS module name if `windows` is not configured.
   * @example `NitroTest`
   */
  getWindowsModuleName(): string {
    return (
      this.config.windows?.windowsModuleName ?? this.config.ios.iosModuleName
    )
  }

  /**
   * Represents the C++ namespace of the module that will be generated.
   * This can have multiple sub-namespaces, and is always relative to `margelo::nitro`.
   * @example `['image']` -> `margelo::nitro::image`
   */
  getCxxNamespace(
    language: 'c++' | 'swift',
    ...subDefinitionName: string[]
  ): string {
    const userNamespace = this.config.cxxNamespace
    const namespace = [
      ...CXX_BASE_NAMESPACE,
      ...userNamespace,
      ...subDefinitionName,
    ]
    switch (language) {
      case 'c++':
        return namespace.join('::')
      case 'swift':
        return namespace.join('.')
      default:
        throw new Error(`Invalid language for getCxxNamespace: ${language}`)
    }
  }

  /**
   * Represents the Android namespace of the module that will be generated.
   * This can have multiple sub-namespaces, and is always relative to `com.margelo.nitro`.
   * @example `['image']` -> `com.margelo.nitro.image`
   */
  getAndroidPackage(
    language: 'java/kotlin' | 'c++/jni',
    ...subPackage: string[]
  ): string {
    const userPackage = this.config.android.androidNamespace
    const namespace = [...ANDROID_BASE_NAMESPACE, ...userPackage, ...subPackage]

    switch (language) {
      case 'java/kotlin':
        return namespace.join('.')
      case 'c++/jni':
        return namespace.join('/')
      default:
        throw new Error(`Invalid language for getAndroidPackage: ${language}`)
    }
  }

  /**
   * Return the directory of the android package, and a given sub-package.
   * This will be used on android to put files from a package in their respective package folder.
   */
  getAndroidPackageDirectory(...subPackage: string[]): string[] {
    const userPackage = this.config.android.androidNamespace
    return [...ANDROID_BASE_NAMESPACE, ...userPackage, ...subPackage]
  }

  /**
   * Get the autolinking configuration of all HybridObjects.
   * Those will be generated and default-constructed.
   */
  getAutolinkedHybridObjects(): NitroUserConfig['autolinking'] {
    return this.config.autolinking
  }

  getPlatformAutolinkedImplementation(
    hybridObjectName: string,
    platform: string
  ): AutolinkingPlatformImplementation | undefined {
    const objectConfig = this.config.autolinking[hybridObjectName]
    if (objectConfig == null) {
      return undefined
    }

    // "all" applies to every platform and should automatically include
    // future platforms without having to expand explicit key lists here.
    if (objectConfig.all != null) {
      return objectConfig.all
    }
    return objectConfig[platform]
  }

  getIosAutolinkedImplementation(
    hybridObjectName: string
  ): AutolinkingIOSImplementation | undefined {
    const objectConfig = this.config.autolinking[hybridObjectName]
    if (objectConfig == null) {
      return undefined
    }
    if (objectConfig.all != null) {
      return objectConfig.all
    }
    return objectConfig.ios
  }

  getAndroidAutolinkedImplementation(
    hybridObjectName: string
  ): AutolinkingAndroidImplementation | undefined {
    const objectConfig = this.config.autolinking[hybridObjectName]
    if (objectConfig == null) {
      return undefined
    }
    if (objectConfig.all != null) {
      return objectConfig.all
    }
    return objectConfig.android
  }

  getWindowsAutolinkedImplementation(
    hybridObjectName: string
  ): AutolinkingWindowsImplementation | undefined {
    const objectConfig = this.config.autolinking[hybridObjectName]
    if (objectConfig == null) {
      return undefined
    }
    if (objectConfig.all != null) {
      return objectConfig.all
    }
    return objectConfig.windows
  }

  /**
   * Get the paths that will be ignored when loading the TypeScript project.
   * In most cases, this just contains `node_modules/`.
   */
  getIgnorePaths(): string[] {
    return this.config.ignorePaths ?? []
  }

  getGitAttributesGeneratedFlag(): boolean {
    return this.config.gitAttributesGeneratedFlag ?? false
  }

  get isExternalConfig(): boolean {
    // If the C++ namespaces are NOT equal, we are an external config.
    return (
      this.getCxxNamespace('c++') !== NitroConfig.current.getCxxNamespace('c++')
    )
  }

  getSwiftBridgeHeaderName(): string {
    const moduleName = this.getIosModuleName()
    return `${moduleName}-Swift-Cxx-Bridge`
  }

  getSwiftBridgeNamespace(language: 'c++' | 'swift'): string {
    return this.getCxxNamespace(language, 'bridge', 'swift')
  }
}
