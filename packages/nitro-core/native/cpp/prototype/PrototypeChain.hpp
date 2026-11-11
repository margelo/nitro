//
//  PrototypeChain.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 07.08.24.
//

#pragma once

#include "Prototype.hpp"

namespace margelo::nitro {

/**
 * Represents a mutable chain of prototypes.
 * Callers can use this class to incrementally add sub-classes to prototypes and build
 * prototype chains/trees using C++ type information.
 *
 * The template methods can be used to find a specific C++ instance in the prototype tree,
 * or create a new sub-class if it cannot be found.
 */
class PrototypeChain final {
private:
  std::shared_ptr<Prototype> _prototype;

public:
  PrototypeChain() {}

public:
  /**
   * Gets the current `Prototype` as a whole.
   * This does not do any modifications to the Prototype tree.
   */
  inline const std::shared_ptr<Prototype>& getPrototype() const {
    return _prototype;
  }

public:
  /**
   * Extends the Prototype with the given type `Derived`.
   * If the Prototype already extended `Derived`, this returns the current state.
   */
  template <typename Derived>
  inline const std::shared_ptr<Prototype>& extendPrototype() {
    if (_prototype == nullptr) {
      _prototype = Prototype::get(typeid(Derived));
    }

    return getOrExtendPrototype<Derived>(_prototype);
  }

private:
  /**
   * Perform a bottom-down search of the given `Derived` C++ type info.
   * If the current prototype tree does not have a Prototype that represents the
   * C++ type `Derived`, it will extend it at the bottom and shift the `Prototype` tree
   * up by one.
   */
  template <typename Derived>
  inline const std::shared_ptr<Prototype>& getOrExtendPrototype(const std::shared_ptr<Prototype>& node) {
    if (node->isNativeInstance<Derived>()) {
      // If the Prototype represents the caller type (`Derived`), we work with this Prototype.
      return node;
    } else {
      if (node->hasBase()) {
        // We didn't find a match in this prototype, let's recursively try its parent!
        return getOrExtendPrototype<Derived>(node->getBase());
      } else {
        // We didn't find `Derived` and we don't have a base- add a child and shift the tree by one.
        auto newBase = _prototype;
        _prototype = Prototype::get(typeid(Derived), newBase);
        return _prototype;
      }
    }
  }
};

} // namespace margelo::nitro
