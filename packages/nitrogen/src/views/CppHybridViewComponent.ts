import type { SourceFile } from '../syntax/SourceFile.js'
import type { HybridObjectSpec } from '../syntax/HybridObjectSpec.js'
import { createIndentation, indent } from '../utils.js'
import { createFileMetadataString, escapeCppName } from '../syntax/helpers.js'
import { getHybridObjectName } from '../syntax/getHybridObjectName.js'
import { getImportsCode } from '../syntax/getImportCode.js'
import { Property } from '../syntax/Property.js'
import { CallbackType } from '../syntax/types/CallbackType.js'
import { VoidType } from '../syntax/types/VoidType.js'
import { HybridObjectType } from '../syntax/types/HybridObjectType.js'
import { NamedWrappingType } from '../syntax/types/NamedWrappingType.js'
import { OptionalType } from '../syntax/types/OptionalType.js'

export function getHybridViewComponentName(spec: HybridObjectSpec): string {
  return spec.config.getHybridClassRegistryName(spec.name)
}

/** Properties inherited from view bases are also React props. */
export function getHybridViewProperties(spec: HybridObjectSpec): Property[] {
  const properties = new Map<string, Property>()
  for (const base of spec.baseTypes) {
    for (const property of getHybridViewProperties(base)) {
      properties.set(property.name, property)
    }
  }
  for (const property of spec.properties) {
    properties.set(property.name, property)
  }
  return [...properties.values()].filter((property) => !property.isReadonly)
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

export function getViewComponentNames(
  spec: HybridObjectSpec
): ViewComponentNames {
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

function getHybridRefProperty(spec: HybridObjectSpec): Property {
  const hybrid = new HybridObjectType(spec)
  const type = new CallbackType(new VoidType(), [
    new NamedWrappingType('ref', hybrid),
  ])
  return new Property('hybridRef', new OptionalType(type), false)
}

export function createViewComponentShadowNodeFiles(
  spec: HybridObjectSpec
): SourceFile[] {
  if (!spec.isHybridView) {
    throw new Error(
      `Cannot create View Component ShadowNode code for ${spec.name} - it's not a HybridView!`
    )
  }

  const { HybridT } = getHybridObjectName(spec.name)
  const {
    propsClassName,
    stateClassName,
    nameVariable,
    shadowNodeClassName,
    descriptorClassName,
    component,
  } = getViewComponentNames(spec)

  const namespace = spec.config.getCxxNamespace('c++', 'views')

  const props = [...getHybridViewProperties(spec), getHybridRefProperty(spec)]
  const properties = props.map(
    (p) =>
      `nitro::ReactProp<${p.type.getCode('c++', { context: 'property' })}> ${escapeCppName(p.name)};`
  )
  const filterCases = props.map(
    (prop) => `case hashString("${prop.name}"): return true;`
  )
  const comparisons = props.map((prop) => {
    const name = escapeCppName(prop.name)
    return `${name}.hasSameValue(other.${name})`
  })
  const providedChecks = props.map((prop) => {
    const name = escapeCppName(prop.name)
    return `${name}.isProvided()`
  })
  const imports = props.flatMap((property) =>
    property.getRequiredImports('c++')
  )
  const includes = getImportsCode(imports, 'implementation')
  const componentHeaderImport = getImportsCode([
    {
      language: 'c++',
      declaration: spec.config.getCxxHeader(
        `views/${component}.hpp`,
        'private'
      ),
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

#include <NitroModules/ReactProp.hpp>
#include <NitroModules/ViewComponentDescriptor.hpp>
#include <NitroModules/ViewPropsHolderState.hpp>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/components/view/ViewProps.h>
#include <react/renderer/core/PropsParserContext.h>
#include <react/renderer/core/RawProps.h>

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
    ...props.map((prop) => {
      const name = escapeCppName(prop.name)
      const type = prop.type.getCode('c++', { context: 'property' })
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
      platform: 'shared',
      subdirectory: [],
      headerVisibility: 'private',
    },
    {
      name: `${component}.cpp`,
      content: componentCode,
      language: 'c++',
      platform: 'shared',
      subdirectory: ['views'],
    },
  ]
  return files
}
