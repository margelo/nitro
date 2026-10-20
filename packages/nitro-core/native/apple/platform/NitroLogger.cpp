//
//  NitroLogger.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#include "NitroLogger.hpp"
#include "NitroDefines.hpp"
#include <os/log.h>

namespace margelo::nitro {

void Logger::nativeLog([[maybe_unused]] LogLevel level,           //
                       [[maybe_unused]] const char* NON_NULL tag, //
                       [[maybe_unused]] const std::string& message) {
#ifdef NITRO_DEBUG
  static os_log_t logger = os_log_create("com.margelo.nitro", "nitro");

  switch (level) {
    case LogLevel::Debug:
      os_log_debug(logger, "[%s] %s", tag, message.c_str());
      break;
    case LogLevel::Info:
      os_log_info(logger, "[%s] %s", tag, message.c_str());
      break;
    case LogLevel::Warning:
      os_log_error(logger, "[%s] %s", tag, message.c_str());
      break;
    case LogLevel::Error:
      os_log_error(logger, "[%s] %s", tag, message.c_str());
      break;
  }
#endif
}

} // namespace margelo::nitro
