import type { NitroConfig } from '../config/NitroConfig.js'
import { getAllTypes } from './getAllTypes.js'
import type { HybridObjectSpec } from './HybridObjectSpec.js'
import { ArrayType } from './types/ArrayType.js'
import { CallbackType } from './types/CallbackType.js'
import { getTypeAs } from './types/getTypeAs.js'
import { HybridObjectType } from './types/HybridObjectType.js'
import { NamedWrappingType } from './types/NamedWrappingType.js'
import { OptionalType } from './types/OptionalType.js'
import { PromiseType } from './types/PromiseType.js'
import { RecordType } from './types/RecordType.js'
import { StructType } from './types/StructType.js'
import { TupleType } from './types/TupleType.js'
import type { Type } from './types/Type.js'
import { VariantType } from './types/VariantType.js'

/** Collect the external Nitro modules referenced by these specs and their types. */
export function getModuleDependencies(
  specs: HybridObjectSpec[],
  config: NitroConfig
): NitroConfig[] {
  const namespace = config.getCxxNamespace('c++')
  const dependencies = new Map<string, NitroConfig>()
  const visitedSpecs = new Set<HybridObjectSpec>()
  const visitedTypes = new Set<Type>()

  function visitConfig(sourceConfig: NitroConfig): void {
    const sourceNamespace = sourceConfig.getCxxNamespace('c++')
    if (sourceNamespace !== namespace) {
      dependencies.set(sourceNamespace, sourceConfig)
    }
  }

  function visitType(type: Type): void {
    if (visitedTypes.has(type)) return
    visitedTypes.add(type)

    if (type instanceof NamedWrappingType) {
      visitType(type.type)
      return
    }

    switch (type.kind) {
      case 'hybrid-object': {
        const hybridObject = getTypeAs(type, HybridObjectType)
        visitConfig(hybridObject.sourceConfig)
        hybridObject.baseTypes.forEach(visitType)
        break
      }
      case 'array': {
        const array = getTypeAs(type, ArrayType)
        visitType(array.itemType)
        break
      }
      case 'callback': {
        const callback = getTypeAs(type, CallbackType)
        visitType(callback.returnType)
        callback.parameters.forEach(visitType)
        break
      }
      case 'optional': {
        const optional = getTypeAs(type, OptionalType)
        visitType(optional.wrappingType)
        break
      }
      case 'promise': {
        const promise = getTypeAs(type, PromiseType)
        visitType(promise.resultingType)
        break
      }
      case 'record': {
        const record = getTypeAs(type, RecordType)
        visitType(record.keyType)
        visitType(record.valueType)
        break
      }
      case 'struct': {
        const struct = getTypeAs(type, StructType)
        struct.properties.forEach(visitType)
        break
      }
      case 'tuple': {
        const tuple = getTypeAs(type, TupleType)
        tuple.itemTypes.forEach(visitType)
        break
      }
      case 'variant': {
        const variant = getTypeAs(type, VariantType)
        variant.variants.forEach(visitType)
        break
      }
    }
  }

  function visitSpec(spec: HybridObjectSpec): void {
    if (visitedSpecs.has(spec)) return
    visitedSpecs.add(spec)

    visitConfig(spec.config)
    getAllTypes(spec).forEach(visitType)
    spec.baseTypes.forEach(visitSpec)
  }

  specs.forEach(visitSpec)
  return [...dependencies.values()]
}
