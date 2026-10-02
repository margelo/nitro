#include "NitroLogger.hpp"

#include <string>

#include <windows.h>

namespace margelo::nitro {

void Logger::nativeLog([[maybe_unused]] LogLevel level,           //
                       [[maybe_unused]] const char* NON_NULL tag, //
                       [[maybe_unused]] const std::string& message) {
#ifdef NITRO_DEBUG
  const char* levelTag;
  switch (level) {
    case LogLevel::Debug:
      levelTag = "[D]";
      break;
    case LogLevel::Info:
      levelTag = "[I]";
      break;
    case LogLevel::Warning:
      levelTag = "[W]";
      break;
    case LogLevel::Error:
      levelTag = "[E]";
      break;
    default:
      levelTag = "[?]";
      break;
  }

  std::string line = std::string(levelTag) + "[" + tag + "] " + message + "\n";
  OutputDebugStringA(line.c_str());
#endif
}

} // namespace margelo::nitro
