//
//  JSIHelpers.hpp
//  Nitro
//
//  Created by Marc Rousavy on 07.08.24.
//

#pragma once

#include "ThreadUtils.hpp"
#include <jsi/jsi.h>

namespace margelo::nitro {

using namespace facebook;

/**
 * Returns whether the given `jsi::Object` is a plain-JS object, or not.
 * If it is not a plain-JS object, it could be an Array, ArrayBuffer, Function,
 * HostObject or NativeState.
 */
static inline bool isPlainObject(jsi::Runtime& runtime, const jsi::Object& object) {
  if (object.isArray(runtime)) {
    return false;
  }
  if (object.isArrayBuffer(runtime)) {
    return false;
  }
  if (object.isFunction(runtime)) {
    return false;
  }
  if (object.isHostObject(runtime)) {
    return false;
  }
  if (object.hasNativeState(runtime)) {
    return false;
  }
  return true;
}

/**
 * Get an ID for the given Runtime.
 *
 * The ID usually consists of a Runtime description (e.g. "HermesRuntime"),
 * and its Thread's name (e.g. "com.facebook.react.runtime.JavaScript")
 */
static inline std::string getRuntimeId(jsi::Runtime& runtime) {
  std::string threadName = ThreadUtils::getThreadName();
  return runtime.description() + " (" + threadName + ")";
}

} // namespace margelo::nitro
