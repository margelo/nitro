import type { Language } from '../getPlatformSpecs.js'
import type { NitroConfig } from '../config/NitroConfig.js'
import { ForeignHybridObjectType } from './c++/ForeignHybridObjectType.js'
import { getAllReferencedTypes } from './getAllTypes.js'
import type { HybridObjectSpec } from './HybridObjectSpec.js'
import { EnumType } from './types/EnumType.js'
import { StructType } from './types/StructType.js'
import { HybridObjectType } from './types/HybridObjectType.js'
import type { Type } from './types/Type.js'

function getHybridObjectConfigs(type: HybridObjectType): NitroConfig[] {
  return [type.sourceConfig, ...type.baseTypes.flatMap(getHybridObjectConfigs)]
}

function getTypeConfigs(type: Type, language: Language, consumer: NitroConfig): NitroConfig[] {
  if (type instanceof StructType || type instanceof EnumType) {
    return [type.declaration.getOwner(language, consumer)]
  }
  if (!(type instanceof HybridObjectType)) return []
  const configs = getHybridObjectConfigs(type)
  if (type instanceof ForeignHybridObjectType && type.definition != null) {
    return [...configs, ...getSpecConfigs(type.definition)]
  }
  return configs
}

function getSpecConfigs(spec: HybridObjectSpec): NitroConfig[] {
  const types = getAllReferencedTypes(spec)
  return [
    spec.config,
    ...spec.baseTypes.flatMap(getSpecConfigs),
    ...types.flatMap((type) => getTypeConfigs(type, spec.language, spec.config)),
  ]
}

/** Native APIs depend on the modules owning their referenced types. */
export function getModuleDependencies(specs: HybridObjectSpec[], config: NitroConfig): NitroConfig[] {
  const configs = specs.flatMap(getSpecConfigs)
  const namespace = config.getCxxNamespace('c++')
  const externalConfigs = configs.filter((dependency) => dependency.getCxxNamespace('c++') !== namespace)
  const dependencies = new Map(externalConfigs.map((dependency) => [dependency.getCxxNamespace('c++'), dependency]))
  return [...dependencies.values()]
}
