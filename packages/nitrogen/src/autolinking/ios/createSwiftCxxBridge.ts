import { indent } from '../../utils.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import {
  createFileMetadataString,
  isNotDuplicate,
} from '../../syntax/helpers.js'
import type { SourceFile } from '../../syntax/SourceFile.js'
import type { CppHelper } from '../../syntax/c++/CppHelper.js'
import type { SwiftType } from '../../syntax/swift/types/SwiftType.js'
import { getUmbrellaHeaderName } from './createSwiftUmbrellaHeader.js'
import { getImportCode, getImportsCode } from '../../syntax/getImportCode.js'

interface SwiftCxxBridge {
  declarations: CppHelper['header']
  implementation: SourceFile
}

export function createSwiftCxxBridge(types: SwiftType[]): SwiftCxxBridge {
  const bridgeSourceName = NitroConfig.current.getSwiftBridgeSourceName()
  const cppNamespace = NitroConfig.current.getSwiftBridgeNamespace('c++')
  const helpers = types.flatMap((type) => type.requiredCppHelpers)
  const headerImports = [
    ...types.flatMap((type) => type.getRequiredImports('c++', 'declaration')),
    ...helpers.flatMap((helper) => helper.header.requiredImports),
  ]
  const declarations = helpers
    .map((helper) => helper.header.code)
    .filter(isNotDuplicate)
  const implementations = helpers.flatMap((helper) =>
    helper.implementation == null ? [] : [helper.implementation]
  )
  const implementationImports = implementations.flatMap(
    (i) => i.requiredImports
  )
  const implementationIncludes = getImportsCode(
    implementationImports,
    'implementation'
  )
  const definitions = implementations.map((i) => i.code).filter(isNotDuplicate)
  const umbrellaInclude = getImportCode({
    language: 'c++',
    declaration: NitroConfig.current.getCxxHeader(
      getUmbrellaHeaderName(),
      'private'
    ),
  })

  const declarationCode = `
namespace ${cppNamespace} {
  ${indent(declarations.join('\n'), '  ')}
} // namespace ${cppNamespace}
`.trim()

  return {
    declarations: {
      code: declarationCode,
      requiredImports: headerImports,
    },
    implementation: {
      name: bridgeSourceName,
      language: 'c++',
      platform: 'ios',
      subdirectory: [],
      content: `
${createFileMetadataString(bridgeSourceName)}
${umbrellaInclude}
${implementationIncludes}

namespace ${cppNamespace} {
  ${indent(definitions.join('\n\n'), '  ')}
} // namespace ${cppNamespace}
`.trim(),
    },
  }
}
