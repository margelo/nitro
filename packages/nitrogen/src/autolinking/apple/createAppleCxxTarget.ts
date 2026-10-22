import { NitroConfig } from '../../config/NitroConfig.js'
import { createFileMetadataString } from '../../syntax/helpers.js'
import type { SourceFile, SourceImport } from '../../syntax/SourceFile.js'
import type { CppHelper } from '../../syntax/c++/CppHelper.js'
import { getImportCode, getImportsCode } from '../../syntax/getImportCode.js'

interface AppleCxxTargetOptions {
  moduleDependencies: NitroConfig[]
  bridgeDeclarations: CppHelper['header']
}

/**
 * Creates the sources of the `<Module>AppleCxx` Swift package target.
 * Its public header declares the C++ bridge that Swift imports.
 */
export function createAppleCxxTarget({ moduleDependencies, bridgeDeclarations }: AppleCxxTargetOptions): SourceFile[] {
  const targetName = NitroConfig.current.getAppleCxxTargetName()
  let dependencyIncludes: string
  if (moduleDependencies.length > 0) {
    const imports: SourceImport[] = moduleDependencies.map((config) => ({
      language: 'c++',
      declaration: config.getAppleCxxHeader(),
    }))
    const includes = getImportsCode(imports, 'declaration')
    dependencyIncludes = `
// Each Nitro module declares parts of the margelo::nitro namespace, and Swift
// treats the namespace as owned by one of them. Re-export the modules this one
// uses, so Swift files that import this module can name the namespace.
${includes}
`.trim()
  } else {
    dependencyIncludes = ''
  }
  const declarationIncludes = getImportsCode(bridgeDeclarations.requiredImports, 'declaration')
  const headerInclude = getImportCode({
    language: 'c++',
    declaration: NitroConfig.current.getAppleCxxHeader(),
  })

  const headerCode = `
${createFileMetadataString(`${targetName}.h`)}

#pragma once
${dependencyIncludes}
${declarationIncludes}

${bridgeDeclarations.code}
  `.trim()
  const implementationCode = `
${createFileMetadataString(`${targetName}.cpp`)}

// Swift packages require at least one source file per C++ target.
${headerInclude}
  `.trim()

  const includeDirectory = [targetName, 'include', targetName]
  return [
    {
      content: headerCode,
      language: 'c++',
      name: `${targetName}.h`,
      platform: 'apple',
      subdirectory: includeDirectory,
    },
    {
      content: implementationCode,
      language: 'c++',
      name: `${targetName}.cpp`,
      platform: 'apple',
      subdirectory: [targetName],
    },
  ]
}
