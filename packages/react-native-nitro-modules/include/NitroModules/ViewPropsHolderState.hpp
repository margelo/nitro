//
// Created by Marc Rousavy on 19.08.26.
//

#pragma once

#include <memory>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <utility>

namespace margelo::nitro {

using namespace facebook;

/**
 * A class that conforms to `react::StateData`, which
 * only holds the given `TProps` via a `shared_ptr`.
 *
 * This is useful to set props via a custom route through
 * JNI on Android, instead of going through react-native's
 * JNI/folly prop parser which is type-limited.
 */
template <typename TProps>
struct ViewPropsHolderState final {
public:
  ViewPropsHolderState() = default;
  explicit ViewPropsHolderState(std::shared_ptr<const TProps> props) : _props(std::move(props)) {}

public:
  [[nodiscard]]
  const std::shared_ptr<const TProps>& getProps() const {
    return _props;
  }

public:
#ifdef ANDROID
  ViewPropsHolderState(const ViewPropsHolderState& /* previousState */, folly::dynamic /* data */) {}
  folly::dynamic getDynamic() const {
    throw std::runtime_error("ViewPropsHolderState<T> does not support folly!");
  }
  react::MapBuffer getMapBuffer() const {
    throw std::runtime_error("ViewPropsHolderState<T> does not support MapBuffer!");
  };
#endif

private:
  std::shared_ptr<const TProps> _props;
};

} // namespace margelo::nitro
