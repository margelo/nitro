import type { SourceFile, SourceImport } from '../../syntax/SourceFile.js'
import type { HybridObjectSpec } from '../../syntax/HybridObjectSpec.js'
import { createViewComponentShadowNodeFiles, getViewComponentNames, getHybridViewProperties } from '../CppHybridViewComponent.js'
import { createFileMetadataString, escapeCppName } from '../../syntax/helpers.js'
import { getUmbrellaHeaderName } from '../../autolinking/apple/createSwiftUmbrellaHeader.js'
import { getHybridObjectName } from '../../syntax/getHybridObjectName.js'
import { indent } from '../../utils.js'
import { getImportsCode } from '../../syntax/getImportCode.js'
import { wrapSwiftType } from '../../syntax/swift/wrapSwiftType.js'

export function createSwiftHybridViewManager(spec: HybridObjectSpec<'swift'>): SourceFile[] {
  const namespace = spec.config.getCxxNamespace('c++')
  const swiftNamespace = spec.config.getAppleModuleName()
  const { HybridTSpecSwift, HybridTSpecCxx } = getHybridObjectName(spec.name)
  const { component, descriptorClassName, propsClassName, shadowNodeClassName } = getViewComponentNames(spec)
  if (spec.implementation == null) {
    throw new Error(`Cannot create Swift HybridView ViewManager for ${spec.name} without an Apple implementation class.`)
  }
  const viewProperties = getHybridViewProperties(spec).map(({ property, config }) => {
    const swiftType = wrapSwiftType(property.type, config)
    return {
      property: property,
      config: config,
      type: swiftType,
    }
  })
  const swiftUmbrellaImport: SourceImport = {
    language: 'c++',
    declaration: spec.config.getCxxHeader(getUmbrellaHeaderName(spec.config), 'private'),
  }
  const cppFiles = createViewComponentShadowNodeFiles(spec, {
    platform: 'apple',
    properties: viewProperties,
    imports: [swiftUmbrellaImport],
  })
  const propertyFiles = viewProperties.flatMap(({ type }) => type.getExtraFiles())
  const imports = getImportsCode([
    {
      language: 'c++',
      declaration: spec.config.getCxxHeader(`views/${component}.hpp`, 'private'),
    },
    {
      language: 'c++',
      declaration: spec.config.getCxxHeader(`${HybridTSpecSwift}.hpp`, 'private'),
    },
    swiftUmbrellaImport,
  ])
  const objcComponentName = `${swiftNamespace}_${component}`
  const propAssignments = viewProperties.map(({ property }) => {
    const name = escapeCppName(property.name)
    const setter = property.getSetterName('other')
    return `
// ${property.jsSignature}
if (oldViewProps == nullptr
      ? newViewProps.${name}.isProvided()
      : !newViewProps.${name}.hasSameValue(oldViewProps->${name})) {
  _hybridView->${setter}(newViewProps.${name}.get());
}
`.trim()
  })
  const mmFile = `
${createFileMetadataString(`${component}.mm`)}

${imports}
#import <memory>
#import <react/renderer/componentregistry/ComponentDescriptorProvider.h>
#import <React/RCTViewComponentView.h>
#import <React/RCTComponentViewFactory.h>
#import <React/UIView+ComponentViewProtocol.h>
#import <NitroModules/NitroDefines.hpp>
#import <UIKit/UIKit.h>


#if __has_include(<cxxreact/ReactNativeVersion.h>)
#include <cxxreact/ReactNativeVersion.h>
#if REACT_NATIVE_VERSION_MINOR >= 82
#define ENABLE_RCT_COMPONENT_VIEW_INVALIDATE
#endif
#endif

using namespace margelo;
using namespace facebook;
using namespace ${namespace};
using namespace ${namespace}::views;

/**
 * Represents the React Native View holder for the Nitro "${spec.name}" HybridView.
 */
@interface ${objcComponentName}: RCTViewComponentView
+ (BOOL)shouldBeRecycled;
@end

@implementation ${objcComponentName} {
  std::shared_ptr<${HybridTSpecSwift}> _hybridView;
  BOOL _didDropView;
}

+ (void) load {
  [super load];
  [RCTComponentViewFactory.currentComponentViewFactory registerComponentViewClass:[${objcComponentName} class]];
}

+ (react::ComponentDescriptorProvider) componentDescriptorProvider {
  return react::concreteComponentDescriptorProvider<${descriptorClassName}>();
}

- (instancetype) init {
  if (self = [super init]) {
    _props = ${shadowNodeClassName}::defaultSharedProps();
    auto swiftView = ${HybridTSpecSwift}::create${spec.name}View();
    auto hybridView = ${swiftNamespace}::${HybridTSpecCxx}::getCxxPart(swiftView);
    _hybridView = std::dynamic_pointer_cast<${HybridTSpecSwift}>(hybridView);
    [self updateView];
  }
  return self;
}

- (void) updateView {
  // 1. Get Swift part
  ${swiftNamespace}::${HybridTSpecCxx}& swiftPart = _hybridView->getSwiftPart();

  // 2. Get UIView*
  void* viewUnsafe = swiftPart.getView();
  UIView* view = (__bridge_transfer UIView*) viewUnsafe;

  // 3. Update RCTViewComponentView's [contentView]
  [self setContentView:view];
}

- (void) notifyOnDropView {
  // A recycled component can later be invalidated. Notify only once per mount.
  if (_didDropView) {
    return;
  }
  ${swiftNamespace}::${HybridTSpecCxx}& swiftPart = _hybridView->getSwiftPart();
  swiftPart.onDropView();
  _didDropView = YES;
}

- (void) updateProps:(const std::shared_ptr<const react::Props>&)props
            oldProps:(const std::shared_ptr<const react::Props>&)oldProps {
  // A props update marks a newly mounted or still-active component.
  _didDropView = NO;

  // 1. Downcast props
  const auto& newViewProps = *std::static_pointer_cast<const ${propsClassName}>(props);
  const auto* oldViewProps = static_cast<const ${propsClassName}*>(oldProps.get());
  ${swiftNamespace}::${HybridTSpecCxx}& swiftPart = _hybridView->getSwiftPart();

  // 2. Update only props that differ from the previous Props snapshot.
  const bool hasTransactionPropChanges = oldViewProps == nullptr
      ? newViewProps.hasAnyProvidedProps()
      : !newViewProps.hasSameProps(*oldViewProps);
  if (hasTransactionPropChanges) {
    swiftPart.beforeUpdate();

    ${indent(propAssignments.join('\n'), '    ')}

    // Update hybridRef if it changed
    if (oldViewProps == nullptr
          ? newViewProps.hybridRef.isProvided()
          : !newViewProps.hybridRef.hasSameValue(oldViewProps->hybridRef)) {
      // hybridRef changed - call it with new this
      const auto& maybeFunc = newViewProps.hybridRef.get();
      if (maybeFunc.has_value()) {
        maybeFunc.value().callAndForget(_hybridView);
      }
    }

    swiftPart.afterUpdate();
  }

  // 3. Continue in base class
  [super updateProps:props oldProps:oldProps];
}

+ (BOOL)shouldBeRecycled {
  return ${swiftNamespace}::${HybridTSpecCxx}::is${spec.name}Recyclable();
}

- (void)prepareForRecycle {
  [self notifyOnDropView];
  [super prepareForRecycle];
  ${swiftNamespace}::${HybridTSpecCxx}& swiftPart = _hybridView->getSwiftPart();
  swiftPart.maybePrepareForRecycle();
}

#ifdef ENABLE_RCT_COMPONENT_VIEW_INVALIDATE
- (void)invalidate {
  [self notifyOnDropView];
  [super invalidate];
}
#endif

@end
  `.trim()

  return [
    ...cppFiles,
    ...propertyFiles,
    {
      content: mmFile,
      language: 'c++',
      name: `${component}.mm`,
      platform: 'apple',
      subdirectory: ['views'],
    },
  ]
}
