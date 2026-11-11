//
//  SwiftClosure.hpp
//  Nitro Modules
//
//  Created by Marc Rousavy on 29.08.24.
//

#pragma once

#include <functional>
#include <memory>

namespace margelo::nitro {

/**
 * Holds a Swift closure, including any captured values via `Unmanaged` context.
 *
 * This internally holds a `std::function`, which can be called via `()`,
 * or accessed directly via `getFunction()`.
 * Copying a `SwiftClosure` will copy the `std::function`.
 */
struct SwiftClosure final {
public:
  using CallFn = void(void* _Nonnull);
  using DeleteFn = void(void* _Nonnull);

private:
  std::function<void()> _function;

public:
  explicit SwiftClosure(void* _Nonnull context, CallFn* _Nonnull call, DeleteFn* _Nonnull destroy) {
    // Create a std::shared_ptr of the `void* context` which calls `destroy`
    // once no references of it exist anymore.
    // Since the std::function captures this std::shared_ptr, it can now be
    // safely copied around, and only once no more references to it exist,
    // `destroy()` will be called.
    std::shared_ptr<void> sharedContext(context, destroy);
    // Create a std::function that captures `sharedContext`.
    // Once it gets destroyed, `destroy()` gets called.
    _function = [sharedContext = std::move(sharedContext), call]() {
      // Call the actual Swift closure.
      call(sharedContext.get());
    };
  }

public:
  /**
   * Call the Swift Closure.
   */
  inline void operator()() {
    _function();
  }

public:
  /**
   * Gets the underlying `std::function`.
   */
  const std::function<void()>& getFunction() const {
    return _function;
  }

  std::function<void()> getFunctionCopy() const {
    return _function;
  }
};

} // namespace margelo::nitro
