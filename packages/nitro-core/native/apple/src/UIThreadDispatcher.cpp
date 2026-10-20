#include <NitroModules/detail/UIThreadDispatcher.hpp>
#include <NitroModules/ThreadUtils.hpp>

namespace margelo::nitro::detail {

UIThreadDispatcher::UIThreadDispatcher() : _queue(dispatch_get_main_queue()) {}

void UIThreadDispatcher::runSync(std::function<void()>&&) {
  throw std::runtime_error("UIThreadDispatcher::runSync() is not implemented!");
}

void UIThreadDispatcher::runAsync(std::function<void()>&& function) {
  std::function<void()>* funcHeap = new std::function<void()>(std::move(function));
  dispatch_async(_queue, ^{
    (*funcHeap)();
    delete funcHeap;
  });
}

bool UIThreadDispatcher::isOnDispatcher() {
  return ThreadUtils::isUIThread();
}

} // namespace margelo::nitro::detail
