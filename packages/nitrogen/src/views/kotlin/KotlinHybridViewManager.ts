import type { SourceFile } from '../../syntax/SourceFile.js'
import type { HybridObjectSpec } from '../../syntax/HybridObjectSpec.js'
import {
  createViewComponentShadowNodeFiles,
  getViewComponentNames,
} from '../CppHybridViewComponent.js'
import {
  createFileMetadataString,
  escapeCppName,
} from '../../syntax/helpers.js'
import { getHybridObjectName } from '../../syntax/getHybridObjectName.js'
import { addJNINativeRegistration } from '../../syntax/kotlin/JNINativeRegistrations.js'
import { indent } from '../../utils.js'

export function createKotlinHybridViewManager(
  spec: HybridObjectSpec
): SourceFile[] {
  const cppFiles = createViewComponentShadowNodeFiles(spec)
  const javaSubNamespace = spec.config.getAndroidPackage('java/kotlin', 'views')
  const javaNamespace = spec.config.getAndroidPackage('java/kotlin')
  const cxxNamespace = spec.config.getCxxNamespace('c++', 'views')
  const { JHybridTSpec, HybridTSpec } = getHybridObjectName(spec.name)
  const {
    manager,
    stateClassName,
    component,
    propsClassName,
    descriptorClassName,
  } = getViewComponentNames(spec)
  const stateUpdaterName = `${stateClassName}Updater`
  const implementation = spec.config.getAndroidAutolinkedImplementation(
    spec.name
  )
  if (implementation?.language !== 'kotlin') {
    throw new Error(
      `Cannot create Kotlin HybridView ViewManager for ${spec.name} - it must be autolinked with a Kotlin Android implementation in nitro.json!`
    )
  }
  const viewImplementation = implementation.implementationClassName

  // React Native's mounting layer can only add children to a `ViewGroup`, and
  // only through a `ViewGroupManager`. Views without children stay on the
  // lighter `SimpleViewManager<View>`, which keeps them exactly as they were.
  const viewType = spec.supportsChildren ? 'ViewGroup' : 'View'
  const managerBase = spec.supportsChildren
    ? 'ViewGroupManager<ViewGroup>'
    : 'SimpleViewManager<View>'
  const viewImport = spec.supportsChildren
    ? 'android.view.ViewGroup'
    : 'android.view.View'
  const managerImport = spec.supportsChildren
    ? 'com.facebook.react.uimanager.ViewGroupManager'
    : 'com.facebook.react.uimanager.SimpleViewManager'

  const viewManagerCode = `
${createFileMetadataString(`${manager}.kt`)}

package ${javaSubNamespace}

import ${viewImport}
import com.facebook.react.uimanager.ReactStylesDiffMap
import ${managerImport}
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.R.id.associated_hybrid_view_tag
import com.margelo.nitro.views.RecyclableView
import ${javaNamespace}.*

/**
 * Represents the React Native \`ViewManager\` for the "${spec.name}" Nitro HybridView.
 */
public class ${manager}: ${managerBase}() {
  /**
   * Represents the View and its last state snapshot (mutable)
   */
  private class HybridViewHolder(
    val hybridView: ${viewImplementation},
    var lastState: StateWrapper? = null,
  )

  init {
    if (RecyclableView::class.java.isAssignableFrom(${viewImplementation}::class.java)) {
      // Enable view recycling
      super.setupViewRecycling()
    }
  }

  override fun getName(): String {
    return "${spec.name}"
  }

  override fun createViewInstance(reactContext: ThemedReactContext): ${viewType} {
    val hybridView = ${viewImplementation}(reactContext)
    val view = hybridView.view
    view.setTag(associated_hybrid_view_tag, HybridViewHolder(hybridView))
    return view
  }

  override fun updateState(view: ${viewType}, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {
    val holder = getHybridViewHolder(view)
      ?: throw Error("Couldn't find view $view in local views table!")
    val hybridView = holder.hybridView
    val oldState = holder.lastState
    val newState = stateWrapper

    // 1. Update each prop individually
    hybridView.beforeUpdate()
    ${stateUpdaterName}.updateViewProps(hybridView, newState, oldState)
    hybridView.afterUpdate()
    holder.lastState = newState

    // 2. Continue in base View props
    return super.updateState(view, props, newState)
  }

  override fun onDropViewInstance(view: ${viewType}) {
    val holder = getHybridViewHolder(view)
    holder?.lastState = null
    holder?.hybridView?.onDropView()
    return super.onDropViewInstance(view)
  }

  protected override fun prepareToRecycleView(reactContext: ThemedReactContext, view: ${viewType}): ${viewType}? {
    val preparedView = super.prepareToRecycleView(reactContext, view)
      ?: return null
    val holder = getHybridViewHolder(preparedView)
      ?: return null
    val hybridView = holder.hybridView
    holder.lastState = null

    @Suppress("USELESS_IS_CHECK")
    if (hybridView is RecyclableView) {
      // Recycle in it's implementation
      hybridView.prepareForRecycle()

      // Maybe update the view if it changed
      return hybridView.view
    } else {
      return null
    }
  }

  private fun getHybridViewHolder(view: ${viewType}): HybridViewHolder? {
    return view.getTag(associated_hybrid_view_tag) as? HybridViewHolder
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

  const updaterJniDescriptor = spec.config.getAndroidPackage(
    'c++/jni',
    'views',
    stateUpdaterName
  )
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
#include "${JHybridTSpec}.hpp"
#include "views/${component}.hpp"

namespace ${cxxNamespace} {

using namespace facebook;

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

  const propsUpdaterCalls = spec.properties.map((p) => {
    const name = escapeCppName(p.name)
    const setter = p.getSetterName('other')
    return `
if (oldProps == nullptr
      ? newProps->${name}.isProvided()
      : !newProps->${name}.hasSameValue(oldProps->${name})) {
  hybridView->${setter}(newProps->${name}.get());
}
    `.trim()
  })
  const updaterJniCppCode = `
${createFileMetadataString(`J${stateUpdaterName}.cpp`)}

#include "J${stateUpdaterName}.hpp"
#include "views/${component}.hpp"
#include <NitroModules/NitroDefines.hpp>
#include <react/fabric/StateWrapperImpl.h>

namespace ${cxxNamespace} {

using namespace facebook;
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
  std::shared_ptr<${JHybridTSpec}> hybridView = javaView->get${JHybridTSpec}();
  std::shared_ptr<const ${propsClassName}> newProps = getPropsFromStateWrapper(newState);
  std::shared_ptr<const ${propsClassName}> oldProps = getPropsFromStateWrapper(oldState);
  if (newProps == nullptr) [[unlikely]] {
    throw std::runtime_error("Current StateWrapper doesn't contain any props!");
  }

  // Update only props that differ from the previous State snapshot.
  ${indent(propsUpdaterCalls.join('\n'), '  ')}

  // Update hybridRef if it changed
  if (oldProps == nullptr
        ? newProps->hybridRef.isProvided()
        : !newProps->hybridRef.hasSameValue(oldProps->hybridRef)) {
    // hybridRef changed - call it with new this
    const auto& maybeFunc = newProps->hybridRef.get();
    if (maybeFunc.has_value()) {
      maybeFunc.value()(hybridView);
    }
  }
}

} // namespace ${cxxNamespace}
`.trim()

  addJNINativeRegistration({
    namespace: cxxNamespace,
    className: `J${stateUpdaterName}`,
    import: {
      name: `views/J${stateUpdaterName}.hpp`,
      space: 'user',
      language: 'c++',
    },
  })

  return [
    ...cppFiles,
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
      name: `J${stateUpdaterName}.hpp`,
      platform: 'android',
      subdirectory: ['views'],
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
