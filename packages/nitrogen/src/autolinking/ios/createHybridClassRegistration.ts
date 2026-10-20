import type { HybridObjectSpec } from '../../syntax/HybridObjectSpec.js'
import type { SourceImport } from '../../syntax/SourceFile.js'
import { getHybridObjectName } from '../../syntax/getHybridObjectName.js'
import { HybridObjectType } from '../../syntax/types/HybridObjectType.js'
import { SwiftHybridObjectType } from '../../syntax/swift/types/SwiftHybridObjectType.js'

interface HybridClassRegistration {
  imports: SourceImport[]
  registration: string
}

export function createHybridClassRegistration(
  spec: HybridObjectSpec
): HybridClassRegistration {
  const names = getHybridObjectName(spec.name)
  const registryName = spec.config.getHybridClassRegistryName(spec.name)
  let className: string
  let header: SourceImport<'c++'>['declaration']
  switch (spec.language) {
    case 'swift':
      className = names.HybridTSpecSwift
      header = new SwiftHybridObjectType(
        new HybridObjectType(spec)
      ).getCxxPartHeader()
      break
    case 'c++':
      className = names.HybridTSpec
      header = new HybridObjectType(spec).getCppHeader()
      break
    case 'kotlin':
      throw new Error('Kotlin class registration is not implemented yet.')
  }
  const registration = `
HybridClassRegistry::registerHybridClass("${registryName}", ${className}::Class::get());
`.trim()
  return {
    imports: [{ language: 'c++', declaration: header }],
    registration: registration,
  }
}
