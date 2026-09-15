#pragma once

#include "Dispatcher.hpp"

#include <functional>
#include <memory>
#include <utility>

#include <ReactDispatcher.h>

namespace margelo::nitro {

class UIThreadDispatcher final : public Dispatcher {
public:
  explicit UIThreadDispatcher(winrt::Microsoft::ReactNative::ReactDispatcher dispatcher) : _dispatcher(std::move(dispatcher)) {}

  void runSync(std::function<void()>&& function) override;
  void runAsync(std::function<void()>&& function) override;

  static bool isUIThread();

  static void setUIDispatcher(const winrt::Microsoft::ReactNative::ReactDispatcher& dispatcher);

  static winrt::Microsoft::ReactNative::ReactDispatcher getUIDispatcher();

private:
  winrt::Microsoft::ReactNative::ReactDispatcher _dispatcher;
};

} // namespace margelo::nitro
