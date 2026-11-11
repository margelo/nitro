#include "UIThreadDispatcher.hpp"

namespace margelo::nitro {

UIThreadDispatcher::UIThreadDispatcher() : _queue(dispatch_get_main_queue()) {}

void UIThreadDispatcher::runSync(std::function<void()>&& function) {
  throw std::runtime_error("UIThreadDispatcher::runSync() is not implemented!");
}

void UIThreadDispatcher::runAsync(std::function<void()>&& function) {
  std::function<void()>* funcHeap = new std::function<void()>(std::move(function));
  dispatch_async(_queue, ^{
    (*funcHeap)();
    delete funcHeap;
  });
}

} // namespace margelo::nitro
