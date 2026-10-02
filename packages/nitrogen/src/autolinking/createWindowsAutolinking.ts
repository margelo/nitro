import type { SourceFile } from '../syntax/SourceFile.js'
import type { Autolinking } from './Autolinking.js'
import { createHybridObjectIntializer } from './windows/createHybridObjectInitializer.js'
import { createMsBuildExtension } from './windows/createMsBuildExtension.js'

interface WindowsAutolinking extends Autolinking {}

export function createWindowsAutolinking(
  allFiles: SourceFile[]
): WindowsAutolinking {
  const hybridObjectInitializer = createHybridObjectIntializer()
  const msBuildExtension = createMsBuildExtension(
    allFiles,
    hybridObjectInitializer.length > 0
  )

  return {
    platform: 'windows',
    sourceFiles: [msBuildExtension, ...hybridObjectInitializer],
  }
}
