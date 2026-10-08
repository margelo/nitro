import { NitroConfig } from '../../config/NitroConfig.js'
import { createCppHybridObjectRegistration } from '../../syntax/c++/CppHybridObjectRegistration.js'
import { includeHeader } from '../../syntax/c++/includeNitroHeader.js'
import { createFileMetadataString } from '../../syntax/helpers.js'
import type { SourceFile, SourceImport } from '../../syntax/SourceFile.js'
import { indent } from '../../utils.js'

type CppFile = Omit<SourceFile, 'language'> & { language: 'c++' }

export function getWindowsAutolinkingClassName(): string {
  return `${NitroConfig.current.getWindowsModuleName()}Autolinking`
}

export function createHybridObjectIntializer(): [CppFile, CppFile] | [] {
  const autolinkingClassName = getWindowsAutolinkingClassName()
  const moduleName = NitroConfig.current.getWindowsModuleName()

  const autolinkedHybridObjects =
    NitroConfig.current.getAutolinkedHybridObjects()

  const cppRegistrations: string[] = []
  const cppImports: SourceImport[] = []
  for (const hybridObjectName of Object.keys(autolinkedHybridObjects)) {
    const implementation =
      NitroConfig.current.getWindowsAutolinkedImplementation(hybridObjectName)
    if (implementation == null) {
      continue
    }

    if (implementation.language !== 'c++') {
      throw new Error(
        `The HybridObject "${hybridObjectName}" cannot be autolinked on Windows - Language "${implementation.language}" is not supported on Windows! ` +
          `Only "c++" is supported on Windows.`
      )
    }

    const { cppCode, requiredImports } = createCppHybridObjectRegistration({
      hybridObjectName: hybridObjectName,
      cppClassName: implementation.implementationClassName,
    })
    cppImports.push(...requiredImports)
    cppRegistrations.push(cppCode)
  }

  if (cppRegistrations.length === 0) {
    // Nothing to autolink!
    return []
  }

  const imports = cppImports.map((i) => includeHeader(i, true)).join('\n')

  const headerCode = `
${createFileMetadataString(`${autolinkingClassName}.hpp`)}

#pragma once

#include <winrt/Microsoft.ReactNative.h>

namespace winrt::${moduleName} {

/**
 * Creates the \`IReactPackageProvider\` that registers all of ${moduleName}'s Hybrid Objects.
 *
 * Add this to your \`react-native.config.js\` so react-native-windows' autolinking
 * calls it for you:
 * \`\`\`js
 * cppHeaders: ['${autolinkingClassName}.hpp'],
 * cppPackageProviders: ['${moduleName}::ReactPackageProvider'],
 * \`\`\`
 */
winrt::Microsoft::ReactNative::IReactPackageProvider ReactPackageProvider();

} // namespace winrt::${moduleName}
  `.trim()

  const cppCode = `
${createFileMetadataString(`${autolinkingClassName}.cpp`)}

#include "${autolinkingClassName}.hpp"

#include "HybridObjectRegistry.hpp"

${imports}

#include <memory>
#include <mutex>
#include <type_traits>

namespace winrt::${moduleName} {

namespace {

struct ${autolinkingClassName} : winrt::implements<${autolinkingClassName}, winrt::Microsoft::ReactNative::IReactPackageProvider> {
  void CreatePackage(winrt::Microsoft::ReactNative::IReactPackageBuilder const& /* packageBuilder */) noexcept {
    static std::once_flag registerOnce;
    std::call_once(registerOnce, []() {
      using namespace margelo::nitro;
      using namespace ${NitroConfig.current.getCxxNamespace('c++')};

      ${indent(cppRegistrations.join('\n'), '      ')}
    });
  }
};

} // namespace

winrt::Microsoft::ReactNative::IReactPackageProvider ReactPackageProvider() {
  return winrt::make<${autolinkingClassName}>();
}

} // namespace winrt::${moduleName}
  `.trim()

  return [
    {
      content: headerCode,
      language: 'c++',
      name: `${autolinkingClassName}.hpp`,
      platform: 'windows',
      subdirectory: [],
    },
    {
      content: cppCode,
      language: 'c++',
      name: `${autolinkingClassName}.cpp`,
      platform: 'windows',
      subdirectory: [],
    },
  ]
}
