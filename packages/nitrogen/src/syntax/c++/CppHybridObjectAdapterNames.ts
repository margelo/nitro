import { NitroConfig } from '../../config/NitroConfig.js'
import { getHybridObjectName } from '../getHybridObjectName.js'

interface HybridObjectAdapterSource {
  hybridObjectName: string
  sourceConfig: NitroConfig
}

/**
 * Adapters belong to their C++ consumer. An external Swift module does not
 * need to emit a C++ API merely because another module might use one.
 */
export function getCppHybridObjectAdapterNames(
  type: HybridObjectAdapterSource,
  owner: NitroConfig = NitroConfig.current
): {
  className: string
  namespace: string
  qualifiedName: string
  fileName: string
  header: { header: string; space: 'system' }
} {
  const className = `${getHybridObjectName(type.hybridObjectName).HybridTSpec}Cxx`
  const sourceNamespace = type.sourceConfig.getCxxNamespace('c++')
  const ownerNamespace = owner.getCxxNamespace('c++')
  const isExternal = sourceNamespace !== ownerNamespace
  const sourceModule = type.sourceConfig.getAppleModuleName()
  const namespace = isExternal ? `${ownerNamespace}::adapters::${sourceModule}` : ownerNamespace
  const fileName = isExternal ? `${className}+${sourceModule}` : className
  return {
    className: className,
    namespace: namespace,
    qualifiedName: `${namespace}::${className}`,
    fileName: fileName,
    header: owner.getCxxHeader(`${fileName}.hpp`),
  }
}
