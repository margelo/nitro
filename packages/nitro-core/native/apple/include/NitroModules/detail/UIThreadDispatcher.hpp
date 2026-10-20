#pragma once

#include <NitroModules/Dispatcher.hpp>
#include <dispatch/dispatch.h>

namespace margelo::nitro::detail {

class UIThreadDispatcher : public Dispatcher {
public:
  UIThreadDispatcher();

  void runSync(std::function<void()>&& function) override;
  void runAsync(std::function<void()>&& function) override;
  bool isOnDispatcher() override;

private:
  dispatch_queue_t _queue;
};

} // namespace margelo::nitro::detail
