#include "UIThreadDispatcher.hpp"

#include <mutex>
#include <stdexcept>
#include <utility>

namespace margelo::nitro {

using namespace winrt::Microsoft::ReactNative;

namespace {

std::mutex& uiDispatcherMutex() {
  static std::mutex mutex;
  return mutex;
}

ReactDispatcher& uiDispatcherStorage() {
  static ReactDispatcher dispatcher{nullptr};
  return dispatcher;
}

} // namespace

void UIThreadDispatcher::setUIDispatcher(const ReactDispatcher& dispatcher) {
  std::lock_guard lock(uiDispatcherMutex());
  uiDispatcherStorage() = dispatcher;
}

ReactDispatcher UIThreadDispatcher::getUIDispatcher() {
  std::lock_guard lock(uiDispatcherMutex());
  ReactDispatcher dispatcher = uiDispatcherStorage();
  if (!dispatcher) {
    throw std::runtime_error("The UI Thread Dispatcher is not available yet - Nitro has not been installed! "
                             "Make sure `NitroModules` is autolinked into your app.");
  }
  return dispatcher;
}

bool UIThreadDispatcher::isUIThread() {
  std::lock_guard lock(uiDispatcherMutex());
  ReactDispatcher dispatcher = uiDispatcherStorage();
  return dispatcher ? dispatcher.HasThreadAccess() : false;
}

void UIThreadDispatcher::runSync(std::function<void()>&& /* function */) {
  throw std::runtime_error("UIThreadDispatcher::runSync() is not implemented on Windows!");
}

void UIThreadDispatcher::runAsync(std::function<void()>&& function) {
  auto shared = std::make_shared<std::function<void()>>(std::move(function));
  _dispatcher.Post([shared]() noexcept { (*shared)(); });
}

} // namespace margelo::nitro
