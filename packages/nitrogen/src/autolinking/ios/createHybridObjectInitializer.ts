import { NitroConfig } from '../../config/NitroConfig.js'
import { createCppHybridObjectRegistration } from '../../syntax/c++/CppHybridObjectRegistration.js'
import { includeHeader } from '../../syntax/c++/includeNitroHeader.js'
import { createFileMetadataString } from '../../syntax/helpers.js'
import type { SourceFile, SourceImport } from '../../syntax/SourceFile.js'
import { createSwiftHybridObjectRegistration } from '../../syntax/swift/SwiftHybridObjectRegistration.js'
import { indent } from '../../utils.js'
import { getUmbrellaHeaderName } from './createSwiftUmbrellaHeader.js'

type ObjcFile = Omit<SourceFile, 'language'> & { language: 'objective-c++' }
type SwiftFile = Omit<SourceFile, 'language'> & { language: 'swift' }

export function createHybridObjectIntializer(
  hybridViewNames: ReadonlySet<string>
): [ObjcFile, SwiftFile] | [] {
  const autolinkingClassName = `${NitroConfig.current.getIosModuleName()}Autolinking`
  const umbrellaHeaderName = getUmbrellaHeaderName()
  const bridgeNamespace = NitroConfig.current.getSwiftBridgeNamespace('swift')

  const autolinkedHybridObjects =
    NitroConfig.current.getAutolinkedHybridObjects()

  const swiftRegistrations: string[] = []
  const cppRegistrations: string[] = []
  const cppImports: SourceImport[] = []
  let containsSwiftObjects = false
  for (const hybridObjectName of Object.keys(autolinkedHybridObjects)) {
    const implementation =
      NitroConfig.current.getIosAutolinkedImplementation(hybridObjectName)
    if (implementation == null) {
      continue
    }

    switch (implementation.language) {
      case 'c++': {
        // Autolink a C++ HybridObject!
        const { cppCode, requiredImports } = createCppHybridObjectRegistration({
          hybridObjectName: hybridObjectName,
          cppClassName: implementation.implementationClassName,
        })
        cppImports.push(...requiredImports)
        cppRegistrations.push(cppCode)
        break
      }
      case 'swift': {
        // Autolink a Swift HybridObject!
        containsSwiftObjects = true
        const { cppCode, requiredImports, swiftRegistrationMethods } =
          createSwiftHybridObjectRegistration({
            hybridObjectName: hybridObjectName,
            swiftClassName: implementation.implementationClassName,
            isHybridView: hybridViewNames.has(hybridObjectName),
          })
        cppImports.push(...requiredImports)
        cppRegistrations.push(cppCode)
        swiftRegistrations.push(swiftRegistrationMethods)
        break
      }
      default:
        throw new Error(
          `The HybridObject "${hybridObjectName}" cannot be autolinked on iOS - Language "${implementation.language}" is not supported on iOS!`
        )
    }
  }

  if (cppRegistrations.length === 0) {
    // Nothing to autolink!
    return []
  }

  const umbrellaImport = containsSwiftObjects
    ? `#import "${umbrellaHeaderName}"`
    : ''
  const imports = cppImports.map((i) => includeHeader(i, true)).join('\n')

  const objcCode = `
${createFileMetadataString(`${autolinkingClassName}.mm`)}

#import <Foundation/Foundation.h>
#import <NitroModules/HybridObjectRegistry.hpp>
${umbrellaImport}
#import <type_traits>

${imports}

@interface ${autolinkingClassName} : NSObject
@end

@implementation ${autolinkingClassName}

+ (void) load {
  using namespace margelo::nitro;
  using namespace ${NitroConfig.current.getCxxNamespace('c++')};

  ${indent(cppRegistrations.join('\n'), '  ')}
}

@end
  `.trim()

  const swiftCode = `
${createFileMetadataString(`${autolinkingClassName}.swift`)}

import NitroModules

// TODO: Use empty enums once Swift supports exporting them as namespaces
//       See: https://github.com/swiftlang/swift/pull/83616
public final class ${autolinkingClassName} {
  public typealias bridge = ${bridgeNamespace}

  ${indent(swiftRegistrations.join('\n\n'), '  ')}
}
  `.trim()

  return [
    {
      content: objcCode,
      language: 'objective-c++',
      name: `${autolinkingClassName}.mm`,
      platform: 'ios',
      subdirectory: [],
    },
    {
      content: swiftCode,
      language: 'swift',
      name: `${autolinkingClassName}.swift`,
      platform: 'ios',
      subdirectory: [],
    },
  ]
}
