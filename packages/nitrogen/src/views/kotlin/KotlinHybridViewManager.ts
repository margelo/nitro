import { getJniCode } from '../../syntax/kotlin/types/KotlinType.js'
import { HybridObjectType } from '../../syntax/types/HybridObjectType.js'
import { KotlinHybridObjectType } from '../../syntax/kotlin/types/KotlinHybridObjectType.js'
import type { SourceFile } from '../../syntax/SourceFile.js'
import type { HybridObjectSpec } from '../../syntax/HybridObjectSpec.js'
import {
  createViewComponentShadowNodeFiles,
  getViewComponentNames,
  getHybridViewComponentName,
  getHybridViewProperties,
  type HybridViewPropertyStorage,
} from '../CppHybridViewComponent.js'
import { createFileMetadataString, escapeCppName } from '../../syntax/helpers.js'
import { getHybridObjectName } from '../../syntax/getHybridObjectName.js'
import { indent } from '../../utils.js'
import { getImportsCode, getImportCode } from '../../syntax/getImportCode.js'
import { getKotlinImplementation } from '../../syntax/kotlin/KotlinMethodHelpers.js'
import { KotlinInstanceMethod } from '../../syntax/kotlin/KotlinInstanceMethod.js'
import { KotlinStoredType } from '../../syntax/kotlin/types/KotlinStoredType.js'
import { KotlinHybridViewType } from './KotlinHybridViewType.js'

export function createKotlinHybridViewManager(spec: HybridObjectSpec<'kotlin'>): SourceFile[] {
  const hybridObject = new KotlinHybridObjectType(new HybridObjectType(spec))
  const javaSubNamespace = spec.config.getAndroidPackage('java/kotlin', 'views')
  const javaNamespace = spec.config.getAndroidPackage('java/kotlin')
  const cxxNamespace = spec.config.getCxxNamespace('c++', 'views')
  const { JHybridTSpec, HybridTSpec } = getHybridObjectName(spec.name)
  const { manager, stateClassName, component, propsClassName, descriptorClassName } = getViewComponentNames(spec)
  const { stateUpdaterName } = new KotlinHybridViewType(spec)
  const implementation = getKotlinImplementation(spec)
  const viewImplementation = implementation.className
  const implementationImport = getImportCode(implementation.kotlinImport)
  const viewProperties = getHybridViewProperties(spec).map(({ property, config }) => ({
    property: property,
    config: config,
    type: new KotlinStoredType(property.type, config),
  })) satisfies readonly HybridViewPropertyStorage[]
  const cppFiles = createViewComponentShadowNodeFiles(spec, { platform: 'android', properties: viewProperties })
  const propertyFiles = viewProperties.flatMap(({ type }) => type.getExtraFiles())
  const componentName = getHybridViewComponentName(spec)
  const componentHeader = spec.config.getCxxHeader(`views/${component}.hpp`, 'private')
  const updaterHeader = spec.config.getCxxHeader(`views/J${stateUpdaterName}.hpp`, 'private')
  const updaterIncludes = getImportsCode([
    { language: 'c++', declaration: updaterHeader },
    { language: 'c++', declaration: componentHeader },
  ])
  const declarationIncludes = getImportsCode([
    {
      language: 'c++',
      declaration: spec.config.getCxxHeader(`${JHybridTSpec}.hpp`, 'private'),
    },
    { language: 'c++', declaration: componentHeader },
  ])

  const viewManagerCode = `
${createFileMetadataString(`${manager}.kt`)}

package ${javaSubNamespace}

import android.view.View
import com.facebook.react.uimanager.ReactStylesDiffMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.R.id.associated_hybrid_view_tag
import com.margelo.nitro.views.RecyclableView
import ${javaNamespace}.*
${implementationImport}

/**
 * Represents the React Native \`ViewManager\` for the "${spec.name}" Nitro HybridView.
 */
public class ${manager}: SimpleViewManager<View>() {
  /**
   * Represents the View and its last state snapshot (mutable)
   */
  private class HybridViewHolder(
    val hybridView: ${HybridTSpec},
    var lastState: StateWrapper? = null,
  )

  init {
    if (RecyclableView::class.java.isAssignableFrom(${viewImplementation}::class.java)) {
      // Enable view recycling
      super.setupViewRecycling()
    }
  }

  override fun getName(): String {
    return "${componentName}"
  }

  override fun createViewInstance(reactContext: ThemedReactContext): View {
    val hybridView = createView(reactContext)
    val view = hybridView.view
    view.setTag(associated_hybrid_view_tag, HybridViewHolder(hybridView))
    return view
  }

  override fun updateState(view: View, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {
    val holder = getHybridViewHolder(view)
      ?: throw Error("Couldn't find view $view in local views table!")
    val hybridView = holder.hybridView
    val oldState = holder.lastState
    val newState = stateWrapper

    // 1. Update each prop individually
    ${stateUpdaterName}.updateViewProps(hybridView, newState, oldState)
    holder.lastState = newState

    // 2. Continue in base View props
    return super.updateState(view, props, newState)
  }

  override fun onDropViewInstance(view: View) {
    val holder = getHybridViewHolder(view)
    holder?.lastState = null
    holder?.hybridView?.onDropView()
    return super.onDropViewInstance(view)
  }

  protected override fun prepareToRecycleView(reactContext: ThemedReactContext, view: View): View? {
    val preparedView = super.prepareToRecycleView(reactContext, view)
      ?: return null
    val holder = getHybridViewHolder(preparedView)
      ?: return null
    val hybridView = holder.hybridView
    holder.lastState = null

    val recyclableView = (hybridView as Any) as? RecyclableView
    if (recyclableView != null) {
      // Reset the implementation while retaining the associated view and holder.
      recyclableView.prepareForRecycle()
      return preparedView
    } else {
      return null
    }
  }

  private fun getHybridViewHolder(view: View): HybridViewHolder? {
    return view.getTag(associated_hybrid_view_tag) as? HybridViewHolder
  }

  companion object {
    @JvmStatic
    fun createView(reactContext: ThemedReactContext): ${HybridTSpec} {
      return ${viewImplementation}(reactContext)
    }
  }
}
  `.trim()

  const updaterKotlinCode = `
${createFileMetadataString(`${stateUpdaterName}.kt`)}

package ${javaSubNamespace}

import com.facebook.react.uimanager.StateWrapper
import ${javaNamespace}.*

internal class ${stateUpdaterName} {
  companion object {
    /**
     * Updates the props for [view] through C++.
     * The [newState] prop is expected to contain [view]'s props as wrapped Fabric state.
     */
    @Suppress("KotlinJniMissingFunction")
    @JvmStatic
    external fun updateViewProps(view: ${HybridTSpec}, newState: StateWrapper, oldState: StateWrapper?)
  }
}
  `.trim()

  const updaterJniDescriptor = spec.config.getAndroidPackage('c++/jni', 'views', stateUpdaterName)
  const updaterJniHeaderCode = `
${createFileMetadataString(`J${stateUpdaterName}.hpp`)}

#pragma once

#ifndef RN_SERIALIZABLE_STATE
#error ${spec.config.getAndroidCxxLibName()} was compiled without the 'RN_SERIALIZABLE_STATE' flag. This flag is required for Nitro Views - set it in your CMakeLists!
#endif

#include <fbjni/fbjni.h>
#include <react/fabric/CoreComponentsRegistry.h>
#include <react/fabric/StateWrapperImpl.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/JStateWrapper.hpp>
${declarationIncludes}

namespace ${cxxNamespace} {

namespace jni = facebook::jni;
namespace react = facebook::react;

class J${stateUpdaterName} final: public jni::JavaClass<J${stateUpdaterName}> {
public:
  static constexpr auto kJavaDescriptor = "L${updaterJniDescriptor};";

public:
  static void updateViewProps(jni::alias_ref<jni::JClass> /* class */,
                              jni::alias_ref<${JHybridTSpec}::JavaPart> view,
                              jni::alias_ref<JStateWrapper::javaobject> newState,
                              jni::alias_ref<JStateWrapper::javaobject> oldState);

private:
  static std::shared_ptr<const ${propsClassName}> getPropsFromStateWrapper(
      jni::alias_ref<JStateWrapper::javaobject> stateWrapper);

public:
  static void registerNatives() {
    // Register JNI calls
    javaClassStatic()->registerNatives({
      makeNativeMethod("updateViewProps", J${stateUpdaterName}::updateViewProps),
    });
    // Register React Native view component descriptor
    auto provider = react::concreteComponentDescriptorProvider<${descriptorClassName}>();
    auto providerRegistry = react::CoreComponentsRegistry::sharedProviderRegistry();
    providerRegistry->add(provider);
  }
};

} // namespace ${cxxNamespace}
  `.trim()

  const propsUpdaterCalls = viewProperties.map(({ property, type }) => {
    const name = escapeCppName(property.name)
    const setter = property.cppSetter
    if (setter == null) {
      throw new Error(`HybridView property ${spec.name}.${property.name} requires a setter.`)
    }
    const kotlinSetter = new KotlinInstanceMethod({ method: setter, accessor: { kind: 'setter', property: property } })
    const jniParameterType = getJniCode(type.type, { context: 'parameter', fullyQualified: true })
    const jniValue = type.getJniValue(`newProps->${name}.get()`)
    const useNonvirtual = hybridObject.canUseNonvirtualJniCalls || kotlinSetter.needsKotlinBridge
    const argumentsList = ['javaView']
    let lookup: string
    if (useNonvirtual) {
      lookup = `${JHybridTSpec}::CxxPart::getClass()->getNonvirtualMethod`
      argumentsList.push(`${JHybridTSpec}::CxxPart::getClass()`)
    } else {
      lookup = `${JHybridTSpec}::JavaPart::javaClassStatic()->getMethod`
    }
    argumentsList.push(jniValue)
    return `
if (oldProps == nullptr
      ? newProps->${name}.isProvided()
      : !newProps->${name}.hasSameValue(oldProps->${name})) {
  static const auto __setter = ${lookup}<void(${jniParameterType})>("${kotlinSetter.name}");
  __setter(${argumentsList.join(', ')});
}
    `.trim()
  })
  const updaterJniCppCode = `
${createFileMetadataString(`J${stateUpdaterName}.cpp`)}

${updaterIncludes}
#include <NitroModules/NitroDefines.hpp>
#include <react/fabric/StateWrapperImpl.h>
#include <stdexcept>

namespace ${cxxNamespace} {

namespace jni = facebook::jni;
namespace react = facebook::react;
using ConcreteStateData = react::ConcreteState<${stateClassName}>;

std::shared_ptr<const ${propsClassName}> J${stateUpdaterName}::getPropsFromStateWrapper(
    jni::alias_ref<JStateWrapper::javaobject> stateWrapper) {
  if (stateWrapper.get() == nullptr) {
    return nullptr;
  }
  // Get concrete StateWrapperImpl from passed StateWrapper interface object
  jobject rawStateWrapper = stateWrapper.get();
  if (!stateWrapper->isInstanceOf(react::StateWrapperImpl::javaClassStatic())) [[unlikely]] {
    throw std::runtime_error("StateWrapper is not a StateWrapperImpl");
  }
  auto stateWrapperImpl = jni::alias_ref<react::StateWrapperImpl::javaobject>{
    static_cast<react::StateWrapperImpl::javaobject>(rawStateWrapper)
  };
  std::shared_ptr<const react::State> state = stateWrapperImpl->cthis()->getState();
  if (state == nullptr) {
    return nullptr;
  }
  auto concreteState = std::static_pointer_cast<const ConcreteStateData>(state);
  const ${stateClassName}& data = concreteState->getData();
  const std::shared_ptr<const ${propsClassName}>& props = data.getProps();
  if (props == nullptr) [[unlikely]] {
    throw std::runtime_error("${stateClassName}'s data doesn't contain any props!");
  }
  return props;
}

void J${stateUpdaterName}::updateViewProps(jni::alias_ref<jni::JClass> /* class */,
                                           jni::alias_ref<${JHybridTSpec}::JavaPart> javaView,
                                           jni::alias_ref<JStateWrapper::javaobject> newState,
                                           jni::alias_ref<JStateWrapper::javaobject> oldState) {
  std::shared_ptr<const ${propsClassName}> newProps = getPropsFromStateWrapper(newState);
  std::shared_ptr<const ${propsClassName}> oldProps = getPropsFromStateWrapper(oldState);
  if (newProps == nullptr) [[unlikely]] {
    throw std::runtime_error("Current StateWrapper doesn't contain any props!");
  }

  const bool hasTransactionPropChanges = oldProps == nullptr
      ? newProps->hasAnyProvidedProps()
      : !newProps->hasSameProps(*oldProps);
  if (hasTransactionPropChanges) {
    static const auto beforeUpdate = ${JHybridTSpec}::JavaPart::javaClassStatic()->getMethod<void()>("beforeUpdate");
    static const auto afterUpdate = ${JHybridTSpec}::JavaPart::javaClassStatic()->getMethod<void()>("afterUpdate");
    beforeUpdate(javaView);

    // Update only props that differ from the previous State snapshot.
    ${indent(propsUpdaterCalls.join('\n'), '    ')}

    if (oldProps == nullptr
          ? newProps->hybridRef.isProvided()
          : !newProps->hybridRef.hasSameValue(oldProps->hybridRef)) {
      const auto& maybeFunc = newProps->hybridRef.get();
      if (maybeFunc.has_value()) {
        auto hybridView = javaView->get${JHybridTSpec}();
        maybeFunc.value().callAndForget(hybridView);
      }
    }

    afterUpdate(javaView);
  }
}

} // namespace ${cxxNamespace}
`.trim()

  return [
    ...cppFiles,
    ...propertyFiles,
    {
      content: viewManagerCode,
      language: 'kotlin',
      name: `${manager}.kt`,
      platform: 'android',
      subdirectory: [...javaSubNamespace.split('.')],
    },
    {
      content: updaterKotlinCode,
      language: 'kotlin',
      name: `${stateUpdaterName}.kt`,
      platform: 'android',
      subdirectory: [...javaSubNamespace.split('.')],
    },
    {
      content: updaterJniHeaderCode,
      language: 'c++',
      name: `views/J${stateUpdaterName}.hpp`,
      platform: 'android',
      subdirectory: [],
      headerVisibility: 'private',
    },
    {
      content: updaterJniCppCode,
      language: 'c++',
      name: `J${stateUpdaterName}.cpp`,
      platform: 'android',
      subdirectory: ['views'],
    },
  ]
}
