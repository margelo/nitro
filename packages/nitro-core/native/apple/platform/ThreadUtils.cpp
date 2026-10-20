//
//  ThreadUtils.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#include "ThreadUtils.hpp"
#include "UIThreadDispatcher.hpp"
#include <dispatch/dispatch.h>
#include <pthread.h>
#include <sstream>
#include <thread>

namespace margelo::nitro {

std::string ThreadUtils::getThreadName() {
  // Try using pthread APIs
  char threadName[64] = {};
  int pthreadResult = pthread_getname_np(pthread_self(), threadName, sizeof(threadName));
  if (pthreadResult == 0 && threadName[0] != '\0') {
    // We have a pthread name
    return std::string(threadName);
  }

  // Try getting DispatchQueue name
  const char* queueName = dispatch_queue_get_label(DISPATCH_CURRENT_QUEUE_LABEL);
  if (queueName != nullptr && queueName[0] != '\0') {
    // We are on a DispatchQueue with a name
    return std::string(queueName);
  }

  // Fall back to std::this_thread
  std::stringstream stream;
  stream << std::this_thread::get_id();
  std::string threadId = stream.str();
  return std::string("Thread #") + threadId;
}

void ThreadUtils::setThreadName(const std::string& name) {
  pthread_setname_np(name.c_str());
}

bool ThreadUtils::isUIThread() {
  return pthread_main_np() != 0;
}

std::shared_ptr<Dispatcher> ThreadUtils::createUIThreadDispatcher() {
  return std::make_shared<UIThreadDispatcher>();
}

} // namespace margelo::nitro
