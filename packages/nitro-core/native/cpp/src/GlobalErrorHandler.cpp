//
//  GlobalErrorHandler.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 14.10.26.
//

#include <NitroModules/GlobalErrorHandler.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/NitroLogger.hpp>
#include <NitroModules/NitroTypeInfo.hpp>
#include <string>

namespace margelo::nitro {

#ifdef NITRO_DEBUG
static const char* getSourceDescription(ErrorSource source) {
  switch (source) {
    case ErrorSource::JSCallback:
      return "A JS callback";
    case ErrorSource::NativeCallback:
      return "A native callback";
    case ErrorSource::Microtask:
      return "A microtask";
    case ErrorSource::Timer:
      return "A timer";
    case ErrorSource::AnimationFrame:
      return "An animation frame callback";
    case ErrorSource::UICallback:
      return "A UI callback";
  }
  return "Unknown source";
}

static std::string getErrorMessage(const std::exception_ptr& error) {
  if (error == nullptr) [[unlikely]] {
    return "null exception_ptr";
  }
  try {
    std::rethrow_exception(error);
  } catch (const std::exception& exception) {
    return exception.what();
  } catch (...) {
    // Some unknown exception was thrown - maybe an Objective-C error?
    return "Unknown " + TypeInfo::getCurrentExceptionName() + " error.";
  }
}
#endif

void GlobalErrorHandler::reportError([[maybe_unused]] ErrorSource source, [[maybe_unused]] std::exception_ptr error) noexcept {
#ifdef NITRO_DEBUG
  try {
    std::string message = getErrorMessage(error);
    Logger::log(LogLevel::Error, TAG, "%s threw an error: %s", getSourceDescription(source), message.c_str());
  } catch (...) {
    // Formatting or logging failed (e.g. out of memory) - there is nothing else we can do here.
  }
#endif
}

} // namespace margelo::nitro
