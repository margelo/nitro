//
// Created by Marc Rousavy on 21.02.24.
//

#pragma once

#include "HybridObject.hpp"
#include <jsi/jsi.h>
#include <memory>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents a `HybridObject` that has been boxed into a `jsi::HostObject`.
 *
 * While `HybridObject`s are runtime agnostic, some threading/worklet libraries do not support copying over objects
 * with `jsi::NativeState` and a prototype chain (which is what a `HybridObject` is), so Nitro offers support for
 * boxing those `HybridObject`s into a type that those libraries support - which is a `jsi::HostObject`.
 *
 * Simply call `unbox()` on this `jsi::HostObject` from the new Runtime/context to get the `HybridObject` again.
 */
class BoxedHybridObject final : public jsi::HostObject {
public:
  explicit BoxedHybridObject(const std::shared_ptr<HybridObject>& hybridObject) : _hybridObject(hybridObject) {}

public:
  jsi::Value get(jsi::Runtime& runtime, const jsi::PropNameID& propName) override;
  std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& runtime) override;

private:
  std::shared_ptr<HybridObject> _hybridObject;
};

} // namespace margelo::nitro
