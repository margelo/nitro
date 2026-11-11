//
//  ThreadUtils.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#include "ThreadUtils.hpp"
#include "JThreadUtils.hpp"
#include "UIThreadDispatcher.hpp"
#include <pthread.h>
#include <sstream>
#include <string>
#include <sys/prctl.h>
#include <thread>

namespace margelo::nitro {

using namespace facebook;

// Implementation for the C++ shared `ThreadUtils` class
std::string ThreadUtils::getThreadName() {
  auto name = JThreadUtils::getCurrentThreadName();
  return name->toStdString();
}

void ThreadUtils::setThreadName(const std::string& name) {
  jni::ThreadScope::WithClassLoader([&]() {
    auto jName = jni::make_jstring(name);
    JThreadUtils::setCurrentThreadName(jName);
  });
}

bool ThreadUtils::isUIThread() {
  return JThreadUtils::isOnUIThread();
}

std::shared_ptr<Dispatcher> ThreadUtils::createUIThreadDispatcher() {
  return std::make_shared<UIThreadDispatcher>();
}

} // namespace margelo::nitro
