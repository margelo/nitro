//
// Created by Marc Rousavy on 27.03.24.
//

#pragma once

#include <NitroModules/Dispatcher.hpp>

#include <ReactCommon/CallInvoker.h>
#include <thread>

namespace margelo::nitro::detail {

using namespace facebook;

/**
 * A Dispatcher that uses react::CallInvoker for its implementation
 */
class CallInvokerDispatcher final : public Dispatcher {
public:
  // Installation runs on the JS Runtime thread in both React Native architectures.
  explicit CallInvokerDispatcher(std::shared_ptr<react::CallInvoker> callInvoker)
      : _callInvoker(callInvoker), _threadId(std::this_thread::get_id()) {}

  void runAsync(std::function<void()>&& function) override {
    _callInvoker->invokeAsync(std::move(function));
  }

  void runSync(std::function<void()>&& function) override {
    _callInvoker->invokeSync(std::move(function));
  }

  bool isOnDispatcher() override {
    return std::this_thread::get_id() == _threadId;
  }

private:
  std::shared_ptr<react::CallInvoker> _callInvoker;
  const std::thread::id _threadId;
};

} // namespace margelo::nitro::detail
