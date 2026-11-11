//
// Created by Marc Rousavy on 29.01.26.
//

#include "UIThreadDispatcher.hpp"
#include "JNativeRunnable.hpp"
#include "JThreadUtils.hpp"
#include <fbjni/fbjni.h>

namespace margelo::nitro {
using namespace facebook;

void UIThreadDispatcher::runAsync(std::function<void()>&& function) {
  auto runnable = JNativeRunnable::newObjectCxxArgs(std::move(function));
  JThreadUtils::runOnUIThread(runnable);
}

void UIThreadDispatcher::runSync(std::function<void()>&&) {
  throw std::runtime_error("UIThreadDispatcher::runSync() is not implemented!");
}
} // namespace margelo::nitro