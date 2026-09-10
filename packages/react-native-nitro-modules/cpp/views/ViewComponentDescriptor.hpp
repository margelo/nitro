//
// Created by Marc Rousavy on 19.08.26.
//

#pragma once

#include "NitroDefines.hpp"

// This header includes <react/renderer/*> headers, which cannot be compiled as part of a
// clang module - so it is hidden from the Swift-facing `NitroModules` module and can only
// be included textually, from C++.
#if !NITRO_BUILDING_MODULE(NitroModules)

#include "RawPropsCompat.hpp"

#include <concepts>
#include <memory>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <utility>

namespace margelo::nitro {

using namespace facebook;

/**
 * A `react::ConcreteComponentDescriptor` implementation for a Nitro View.
 *
 * Requires the `TShadowNode` to be a `react::ShadowNode` composited of `Props`
 * which support Raw Props Parsing, and `State` which supports holding `Props`
 * for direct transfer to JNI on Android.
 */
template <typename TShadowNode>
class ViewComponentDescriptor final : public react::ConcreteComponentDescriptor<TShadowNode> {
  using Base = react::ConcreteComponentDescriptor<TShadowNode>;
  using Props = typename TShadowNode::ConcreteProps;
  using State = typename TShadowNode::ConcreteStateData;

#ifdef ANDROID
  static_assert(std::constructible_from<State, const std::shared_ptr<const Props>&>,
                "TShadowNode::ConcreteStateData must be constructible from "
                "const std::shared_ptr<const TShadowNode::ConcreteProps>& on Android.");
#endif

public:
  explicit ViewComponentDescriptor(const react::ComponentDescriptorParameters& parameters)
      : Base(parameters, RawPropsCompat::makePropsParser()) {}

public:
  /**
   * A faster path for cloning props - reuses the caching logic from the `Props`.
   */
  std::shared_ptr<const react::Props> cloneProps(const react::PropsParserContext& context, const std::shared_ptr<const react::Props>& props,
                                                 react::RawProps rawProps) const override {
    // 1. Prepare raw props parser
    rawProps.parse(this->rawPropsParser_);
    // 2. Copy props with Nitro's cached copy constructor
    return TShadowNode::Props(context, /* & */ rawProps, props);
  }

#ifdef ANDROID
  void adopt(react::ShadowNode& shadowNode) const override {
    Base::adopt(shadowNode);

    // This is called immediately after `ShadowNode` is created, cloned or in progress.
    // On Android, we need to wrap props in our state, which gets routed through Java and later unwrapped in JNI/C++.
    auto& concreteShadowNode = static_cast<TShadowNode&>(shadowNode);
    // Start from the stable shared pointer stored by ShadowNode. Some React Native versions implement
    // `getConcreteSharedProps()` by returning a reference to a temporary cast result.
    auto constBaseProps = concreteShadowNode.getProps();
    auto constProps = std::static_pointer_cast<const Props>(constBaseProps);
    const std::shared_ptr<const Props>& previousProps = concreteShadowNode.getStateData().getProps();
    if (previousProps != nullptr && constProps->hasSameProps(*previousProps)) {
      // None of the Nitro props changed. Keep the existing State identity so
      // Fabric does not schedule an Android State update for base View props.
      return;
    }

    State state{std::move(constProps)};
    concreteShadowNode.setStateData(std::move(state));
  }
#endif
};

} // namespace margelo::nitro

#endif
