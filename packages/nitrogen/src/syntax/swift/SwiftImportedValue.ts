import type { NitroConfig } from '../../config/NitroConfig.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'

export function getImportedSwiftValueName(config: NitroConfig, name: string): string {
  const module = config.getAppleModuleName()
  return `__NitroValue${module.length}_${module}_${name}`
}

/** Resolve the Swift owner without importing the C++ namespace of the same name. */
export function createImportedSwiftValue(config: NitroConfig, name: string): SourceFile {
  const module = config.getAppleModuleName()
  const alias = getImportedSwiftValueName(config, name)
  const file = alias + '.swift'
  const metadata = createFileMetadataString(file)
  const content = `
${metadata}

public import ${module}

public typealias ${alias} = ${module}.${name}
`.trim()
  return { name: file, content: content, platform: 'apple', language: 'swift', subdirectory: [] }
}
