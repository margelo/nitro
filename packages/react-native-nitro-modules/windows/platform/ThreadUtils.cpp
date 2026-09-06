#include "ThreadUtils.hpp"
#include "UIThreadDispatcher.hpp"

#include <memory>
#include <sstream>
#include <string>
#include <thread>

#include <windows.h>

#include <processthreadsapi.h>

namespace margelo::nitro {

namespace {

std::string toUtf8(PCWSTR wide) {
  if (wide == nullptr || wide[0] == L'\0') {
    return {};
  }
  int size = WideCharToMultiByte(CP_UTF8, 0, wide, -1, nullptr, 0, nullptr, nullptr);
  if (size <= 1) {
    return {};
  }
  std::string result(static_cast<size_t>(size) - 1, '\0');
  WideCharToMultiByte(CP_UTF8, 0, wide, -1, result.data(), size, nullptr, nullptr);
  return result;
}

std::wstring toUtf16(const std::string& narrow) {
  if (narrow.empty()) {
    return {};
  }
  int size = MultiByteToWideChar(CP_UTF8, 0, narrow.c_str(), -1, nullptr, 0);
  if (size <= 1) {
    return {};
  }
  std::wstring result(static_cast<size_t>(size) - 1, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, narrow.c_str(), -1, result.data(), size);
  return result;
}

} // namespace

std::string ThreadUtils::getThreadName() {
  PWSTR description = nullptr;
  if (SUCCEEDED(GetThreadDescription(GetCurrentThread(), &description))) {
    std::string name = toUtf8(description);
    LocalFree(description);
    if (!name.empty()) {
      return name;
    }
  }

  std::stringstream stream;
  stream << std::this_thread::get_id();
  return std::string("Thread #") + stream.str();
}

void ThreadUtils::setThreadName(const std::string& name) {
  std::wstring wideName = toUtf16(name);
  if (wideName.empty()) {
    return;
  }
  SetThreadDescription(GetCurrentThread(), wideName.c_str());
}

bool ThreadUtils::isUIThread() {
  return UIThreadDispatcher::isUIThread();
}

std::shared_ptr<Dispatcher> ThreadUtils::createUIThreadDispatcher() {
  return std::make_shared<UIThreadDispatcher>(UIThreadDispatcher::getUIDispatcher());
}

} // namespace margelo::nitro
