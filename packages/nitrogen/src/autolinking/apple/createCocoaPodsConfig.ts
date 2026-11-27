import { NitroConfig } from '../../config/NitroConfig.js'
import type { SourceFile } from '../../syntax/SourceFile.js'

interface CocoaPodsConfigOptions {
  moduleDependencies: NitroConfig[]
}

/** Describes the native modules needed by the CocoaPods build helper. */
export function createCocoaPodsConfig({ moduleDependencies }: CocoaPodsConfigOptions): Omit<SourceFile, 'language'> {
  const moduleName = NitroConfig.current.getAppleModuleName()
  const dependencies = moduleDependencies.map((dependency) => dependency.getAppleModuleName())
  const config = {
    moduleName: moduleName,
    dependencies: dependencies,
  }

  return {
    name: `${moduleName}+autolinking.json`,
    content: JSON.stringify(config, null, 2),
    platform: 'apple',
    subdirectory: [],
  }
}
