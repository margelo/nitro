//
//  GlobalErrorHandler.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 14.10.26.
//

#pragma once

#include <exception>

namespace margelo::nitro {

/**
 * Where an error reported to the `GlobalErrorHandler` happened.
 */
enum class ErrorSource {
  /**
   * A JS callback that was called asynchronously, without a caller waiting for its result.
   */
  JSCallback,
  /**
   * A native callback that was called without a caller waiting for its result.
   */
  NativeCallback,
  /**
   * A JS microtask, e.g. a Promise continuation, that ran after a native call into JS.
   */
  Microtask,
  /**
   * A `setTimeout` or `setInterval` callback.
   */
  Timer,
  /**
   * A `requestAnimationFrame` callback.
   */
  AnimationFrame,
  /**
   * A callback for a UI event, e.g. a key press or a finished view controller presentation.
   */
  UICallback,
};

/**
 * Receives errors that cannot be delivered to JS, for example because nobody
 * awaits the call that threw.
 *
 * Errors reported here are currently logged in debug builds.
 */
class GlobalErrorHandler final {
private:
  GlobalErrorHandler() = delete;

public:
  /**
   * Reports the given `error` that happened in the given `source`.
   *
   * This never throws, so it is safe to call from `catch` blocks and destructors.
   */
  static void reportError(ErrorSource source, std::exception_ptr error) noexcept;

private:
  static constexpr auto TAG = "GlobalErrorHandler";
};

} // namespace margelo::nitro
