//
//  ThreadUtils.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "Dispatcher.hpp"
#include <memory>
#include <string>

namespace margelo::nitro {

class ThreadUtils final {
public:
  ThreadUtils() = delete;

  /**
   * Get the current Thread's name.
   * This is implemented differently on iOS and Android.
   */
  static std::string getThreadName();

  /**
   * Set the current Thread's name.
   * This is implemented differently on iOS and Android.
   */
  static void setThreadName(const std::string& name);

  /**
   * Gets whether the caller is currently running
   * on the Main/UI Thread.
   */
  static bool isUIThread();

  /**
   * Create a `Dispatcher` for the Main/UI Thread.
   */
  static std::shared_ptr<Dispatcher> createUIThreadDispatcher();
};

} // namespace margelo::nitro
