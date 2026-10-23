import { NitroConfig } from '../../config/NitroConfig.js'
import { createFileMetadataString } from '../../syntax/helpers.js'
import type { SourceFile } from '../../syntax/SourceFile.js'

export function createGradleExtension(): Omit<SourceFile, 'language'> & {
  language: 'gradle'
} {
  const name = `${NitroConfig.current.getAndroidCxxLibName()}+autolinking.gradle`
  const code = `
${createFileMetadataString(name)}

// Resolve beside this script so custom Nitrogen output directories work too.
def nitrogenDirectory = buildscript.sourceFile.parentFile
android.sourceSets.main.java.srcDirs += [new File(nitrogenDirectory, 'kotlin')]

// UInt64 arrays are Kotlin ULongArrays, which still require an opt-in.
plugins.withId('org.jetbrains.kotlin.android') {
  kotlin.sourceSets.configureEach {
    languageSettings.optIn('kotlin.ExperimentalUnsignedTypes')
  }
}
`.trim()
  return {
    language: 'gradle',
    name: name,
    platform: 'android',
    subdirectory: [],
    content: code,
  }
}
