#pragma once

#include "Dispatcher.hpp"
#include <dispatch/dispatch.h>

namespace margelo::nitro {

class UIThreadDispatcher : public Dispatcher {
public:
  UIThreadDispatcher();

  void runSync(std::function<void()>&& function) override;
  void runAsync(std::function<void()>&& function) override;

private:
  dispatch_queue_t _queue;
};

} // namespace margelo::nitro
