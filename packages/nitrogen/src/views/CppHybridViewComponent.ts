import type { SourceFile, SourceImport } from '../syntax/SourceFile.js'
import type { HybridObjectSpec } from '../syntax/HybridObjectSpec.js'
import { createIndentation, indent } from '../utils.js'
import { createFileMetadataString, escapeCppName } from '../syntax/helpers.js'
import { getHybridObjectName } from '../syntax/getHybridObjectName.js'
import { getImportsCode } from '../syntax/getImportCode.js'
import { Property } from '../syntax/Property.js'
import { CallbackType } from '../syntax/types/CallbackType.js'
import { VoidType } from '../syntax/types/VoidType.js'
import { AnyHybridObjectType } from '../syntax/types/AnyHybridObjectType.js'
import { NamedWrappingType } from '../syntax/types/NamedWrappingType.js'
import { OptionalType } from '../syntax/types/OptionalType.js'
import type { NitroConfig } from '../config/NitroConfig.js'
import type { Platform } from '../getPlatformSpecs.js'
import type { Type } from '../syntax/types/Type.js'

export function getHybridViewComponentName(spec: HybridObjectSpec): string {
  return spec.config.getHybridClassRegistryName(spec.name)
}

interface HybridViewProperty {
  readonly property: Property
  readonly config: NitroConfig
}

export interface HybridViewPropertyStorage extends HybridViewProperty {
  readonly type: Type
}

interface HybridViewComponentOptions {
  readonly platform: Platform
  readonly properties: readonly HybridViewPropertyStorage[]
  readonly imports?: SourceImport[]
}

/** Inherited React props retain the native module that declares their setters. */
export function getHybridViewProperties(spec: HybridObjectSpec): HybridViewProperty[] {
  const properties = new Map<string, HybridViewProperty>()
  for (const base of spec.baseTypes) {
    for (const inherited of getHybridViewProperties(base)) {
      properties.set(inherited.property.name, inherited)
    }
  }
  for (const property of spec.properties) {
    properties.set(property.name, { property: property, config: spec.config })
  }
  return [...properties.values()].filter(({ property }) => !property.isReadonly)
}

interface ViewComponentNames {
  propsClassName: `${string}Props`
  stateClassName: `${string}State`
  nameVariable: `${string}ComponentName`
  shadowNodeClassName: `${string}ShadowNode`
  descriptorClassName: `${string}ComponentDescriptor`
  component: `${string}Component`
  manager: `${string}Manager`
}

export function getViewComponentNames(spec: HybridObjectSpec): ViewComponentNames {
  const name = getHybridObjectName(spec.name)
  return {
    propsClassName: `${name.HybridT}Props`,
    stateClassName: `${name.HybridT}State`,
    nameVariable: `${name.HybridT}ComponentName`,
    shadowNodeClassName: `${name.HybridT}ShadowNode`,
    descriptorClassName: `${name.HybridT}ComponentDescriptor`,
    component: `${name.HybridT}Component`,
    manager: `${name.HybridT}Manager`,
  }
}

function getHybridRefProperty(): Property {
  const hybrid = new AnyHybridObjectType()
  const type = new CallbackType(new VoidType(), [new NamedWrappingType('ref', hybrid)])
  return new Property('hybridRef', new OptionalType(type), false)
}

export function createViewComponentShadowNodeFiles(
  spec: HybridObjectSpec,
  { platform, properties: viewProperties, imports: additionalImports = [] }: HybridViewComponentOptions
): SourceFile[] {
  if (!spec.isHybridView) {
    throw new Error(`Cannot create View Component ShadowNode code for ${spec.name} - it's not a HybridView!`)
  }

  const { HybridT } = getHybridObjectName(spec.name)
  const { propsClassName, stateClassName, nameVariable, shadowNodeClassName, descriptorClassName, component } = getViewComponentNames(spec)

  const namespace = spec.config.getCxxNamespace('c++', 'views')

  const hybridRef = getHybridRefProperty()
  const props: readonly HybridViewPropertyStorage[] = [
    ...viewProperties,
    { property: hybridRef, config: spec.config, type: hybridRef.type },
  ]
  const properties = props.map(
    ({ property, type }) => `nitro::ReactProp<${type.getCode('c++', { context: 'property' })}> ${escapeCppName(property.name)};`
  )
  const filterCases = props.map(({ property }) => `case hashString("${property.name}"): return true;`)
  const comparisons = props.map(({ property: prop }) => {
    const name = escapeCppName(prop.name)
    return `${name}.hasSameValue(other.${name})`
  })
  const providedChecks = props.map(({ property: prop }) => {
    const name = escapeCppName(prop.name)
    return `${name}.isProvided()`
  })
  const imports = [...additionalImports, ...props.flatMap(({ type }) => type.getRequiredImports('c++'))]
  const includes = getImportsCode(imports, 'implementation')
  const componentHeaderImport = getImportsCode([
    {
      language: 'c++',
      declaration: spec.config.getCxxHeader(`views/${component}.hpp`, 'private'),
    },
  ])
  const componentName = getHybridViewComponentName(spec)
  const comparisonsCode = comparisons.join(' &&\n             ')
  const providedChecksCode = providedChecks.join(' ||\n             ')

  // .hpp code
  const shadowIndent = createIndentation(shadowNodeClassName.length)
  const componentHeaderCode = `
${createFileMetadataString(`${component}.hpp`)}

#pragma once

#include <NitroModules/ReactNativeCore.hpp>
#include <NitroModules/ReactProp.hpp>
#include <NitroModules/ViewComponentDescriptor.hpp>
#include <NitroModules/ViewPropsHolderState.hpp>
#if __has_include(<React/View.h>)
#include <React/View.h>
#else
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/components/view/ViewProps.h>
#endif

#include <string>

${includes}

namespace ${namespace} {

  using namespace margelo;
  using namespace facebook;

  /**
   * The name of the actual native View.
   */
  extern const char ${nameVariable}[];

  /**
   * Props for the "${spec.name}" View.
   */
  class ${propsClassName} final: public react::ViewProps {
  public:
    ${propsClassName}() = default;
    ${propsClassName}(const react::PropsParserContext& context,
  ${createIndentation(propsClassName.length)}   const ${propsClassName}& sourceProps,
  ${createIndentation(propsClassName.length)}   const react::RawProps& rawProps);

  public:
    ${indent(properties.join('\n'), '    ')}

    [[nodiscard]]
    bool hasSameProps(const ${propsClassName}& other) const noexcept {
      return ${comparisonsCode};
    }

    [[nodiscard]]
    bool hasAnyProvidedProps() const noexcept {
      return ${providedChecksCode};
    }

  private:
    static bool filterObjectKeys(const std::string& propName);
  };

  /**
   * State for the "${spec.name}" View.
   */
  using ${stateClassName} = nitro::ViewPropsHolderState<${propsClassName}>;

  /**
   * The Shadow Node for the "${spec.name}" View.
   */
  using ${shadowNodeClassName} = react::ConcreteViewShadowNode<${nameVariable} /* "${HybridT}" */,
        ${shadowIndent}                                 ${propsClassName} /* custom props */,
        ${shadowIndent}                                 react::ViewEventEmitter /* default */,
        ${shadowIndent}                                 ${stateClassName} /* custom state */>;

  /**
   * The Component Descriptor for the "${spec.name}" View.
   */
  using ${descriptorClassName} = nitro::ViewComponentDescriptor<${shadowNodeClassName}>;

  /* The actual view for "${spec.name}" needs to be implemented in platform-specific code. */

} // namespace ${namespace}
`.trim()

  const propInitializers = [
    'react::ViewProps(context, sourceProps, rawProps, filterObjectKeys)',
    ...props.map(({ property: prop, type: storageType }) => {
      const name = escapeCppName(prop.name)
      const type = storageType.getCode('c++', { context: 'property' })
      return `${name}(nitro::ReactProp<${type}>::fromRawValue("${spec.name}", "${prop.name}", rawProps, sourceProps.${name}))`
    }),
  ]
  const ctorIndent = createIndentation(propsClassName.length * 2)
  const componentCode = `
${createFileMetadataString(`${component}.cpp`)}

${componentHeaderImport}

#include <NitroModules/NitroHash.hpp>
#include <NitroModules/RawPropsCompat.hpp>
#include <NitroModules/ReactProp.hpp>

namespace ${namespace} {

  using namespace margelo;
  using namespace facebook;

  extern const char ${nameVariable}[] = "${componentName}";

  ${propsClassName}::${propsClassName}(const react::PropsParserContext& context,
  ${ctorIndent}   const ${propsClassName}& sourceProps,
  ${ctorIndent}   const react::RawProps& rawProps):
    ${indent(propInitializers.join(',\n'), '    ')} {
#ifdef ANDROID
    nitro::RawPropsCompat::initializeDynamicProps(*this, sourceProps, rawProps, filterObjectKeys);
#endif
  }

  bool ${propsClassName}::filterObjectKeys(const std::string& propName) {
    switch (hashString(propName)) {
      ${indent(filterCases.join('\n'), '      ')}
      default: return false;
    }
  }

} // namespace ${namespace}
`.trim()

  const files: SourceFile[] = [
    {
      name: `views/${component}.hpp`,
      content: componentHeaderCode,
      language: 'c++',
      platform: platform,
      subdirectory: [],
      headerVisibility: 'private',
    },
    {
      name: `${component}.cpp`,
      content: componentCode,
      language: 'c++',
      platform: platform,
      subdirectory: ['views'],
    },
  ]
  return files
}
