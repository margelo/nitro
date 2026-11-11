
#pragma once

#include "Dispatcher.hpp"

namespace margelo::nitro {

class UIThreadDispatcher : public Dispatcher {
public:
  void runSync(std::function<void()>&& function) override;
  void runAsync(std::function<void()>&& function) override;
};

} // namespace margelo::nitro