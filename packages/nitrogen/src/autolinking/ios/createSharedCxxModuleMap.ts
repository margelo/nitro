import { NitroConfig } from '../../config/NitroConfig.js'
import type { HybridObjectSpec } from '../../syntax/HybridObjectSpec.js'
import { createFileMetadataString } from '../../syntax/helpers.js'
import type { SourceFile } from '../../syntax/SourceFile.js'
import { getViewComponentNames } from '../../views/CppHybridViewComponent.js'
import { indent } from '../../utils.js'

/** Keep implementation-only Fabric declarations out of Swift's C++ module. */
export function createSharedCxxModuleMap(
  specs: HybridObjectSpec[]
): SourceFile[] {
  const views = specs.filter((spec) => spec.isHybridView)
  if (views.length === 0) return []

  const moduleName = NitroConfig.current.getIosModuleName()
  const excludedHeaders = views.map((spec) => {
    const { component } = getViewComponentNames(spec)
    return `exclude header "${moduleName}/private/views/${component}.hpp"`
  })
  const code = `
${createFileMetadataString('module.modulemap')}

module ${moduleName}Cxx {
  requires cplusplus
  umbrella "${moduleName}"
  ${indent(excludedHeaders.join('\n'), '  ')}
  export *
}
`.trim()
  return [
    {
      name: 'module.modulemap',
      language: 'c++',
      platform: 'shared',
      subdirectory: ['c++', 'include'],
      content: code,
    },
  ]
}
