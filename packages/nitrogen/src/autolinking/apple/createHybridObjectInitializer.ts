import { NitroConfig } from '../../config/NitroConfig.js'
import { getImportCode, getImportsCode } from '../../syntax/getImportCode.js'
import { createFileMetadataString } from '../../syntax/helpers.js'
import type { SourceFile, SourceImport } from '../../syntax/SourceFile.js'
import { indent } from '../../utils.js'
import type { HybridObjectSpec } from '../../syntax/HybridObjectSpec.js'
import { createHybridClassRegistration } from '../createHybridClassRegistration.js'

export function createHybridObjectInitializer(specs: HybridObjectSpec[]): SourceFile[] {
  const autolinkingClassName = `${NitroConfig.current.getIosModuleName()}Autolinking`
  const namespace = NitroConfig.current.getCxxNamespace('c++')

  const cppRegistrations: string[] = []
  const cppImports: SourceImport[] = []
  for (const spec of specs) {
    const registration = createHybridClassRegistration(spec)
    cppImports.push(...registration.imports)
    cppRegistrations.push(registration.registration)
  }
  if (cppRegistrations.length === 0) {
    // Nothing to autolink!
    return []
  }

  const includes = getImportsCode(cppImports, 'implementation')
  const autolinkingInclude = getImportCode({
    language: 'c++',
    declaration: NitroConfig.current.getCxxHeader(`${autolinkingClassName}.hpp`),
  })

  const cppHeaderCode = `
${createFileMetadataString(`${autolinkingClassName}.hpp`)}

#pragma once

namespace ${namespace} {
  // Register all generated HybridObject classes
  void registerHybridClasses();
} // namespace ${namespace}

  `.trim()
  const cppImplementationCode = `
${createFileMetadataString(`${autolinkingClassName}.cpp`)}

${autolinkingInclude}
#include <NitroModules/HybridClassRegistry.hpp>

${includes}

namespace ${namespace} {
  void registerHybridClasses() {
    using namespace margelo::nitro;
    using namespace ${NitroConfig.current.getCxxNamespace('c++')};

    ${indent(cppRegistrations.join('\n'), '    ')}
  }
} // namespace ${namespace}
  `.trim()

  const objcImplementationCode = `
${createFileMetadataString(`${autolinkingClassName}.mm`)}

#import <Foundation/Foundation.h>
${autolinkingInclude}

/**
 * Registers all HybridObject classes of ${NitroConfig.current.getIosModuleName()}
 * when the app loads, so JS can look them up by name.
 */
@interface ${autolinkingClassName} : NSObject
@end

@implementation ${autolinkingClassName}

+ (void)load {
  ${namespace}::registerHybridClasses();
}

@end
  `.trim()

  return [
    {
      content: cppHeaderCode,
      language: 'c++',
      name: `${autolinkingClassName}.hpp`,
      platform: 'ios',
      subdirectory: ['c++'],
      headerVisibility: 'public',
    },
    {
      content: cppImplementationCode,
      language: 'c++',
      name: `${autolinkingClassName}.cpp`,
      platform: 'ios',
      subdirectory: [],
    },
    {
      content: objcImplementationCode,
      language: 'c++',
      name: `${autolinkingClassName}.mm`,
      platform: 'ios',
      subdirectory: [],
    },
  ]
}
