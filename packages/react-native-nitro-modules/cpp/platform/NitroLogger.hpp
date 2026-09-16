//
// Created by Marc Rousavy on 05.03.24.
//

#pragma once

#include "NitroDefines.hpp"
#include <cstdarg>
#include <cstdio>
#include <iostream>
#include <sstream>
#include <string>
#include <type_traits>

namespace margelo::nitro {

enum class LogLevel { Debug, Info, Warning, Error };

constexpr LogLevel kMinLogLevel = [] {
#ifdef NITRO_MIN_LOG_LEVEL
    constexpr int v = NITRO_MIN_LOG_LEVEL; // passed via -DNITRO_MIN_LOG_LEVEL=0..3
    static_assert(v >= 0 && v <= 3, "NITRO_MIN_LOG_LEVEL is out of range!");
    return static_cast<LogLevel>(v);
#else
    return LogLevel::Warning; // default is just warning
#endif
}();

class Logger final {
private:
  Logger() = delete;

public:
  template <typename... Args>
  static void log([[maybe_unused]] LogLevel level,              //
                  [[maybe_unused]] const char* NON_NULL tag,    //
                  [[maybe_unused]] const char* NON_NULL format, //
                  [[maybe_unused]] Args... args) {
#ifdef NITRO_DEBUG
    // 1. Make sure args can be passed to sprintf(..)
    static_assert(all_are_trivially_copyable<Args...>(), "All arguments passed to Logger::log(..) must be trivially copyable! "
                                                         "Did you try to pass a complex type, like std::string?");

    // 2. Make sure we want to enable those kinds of logs - if not, return
    if (static_cast<int>(level) < static_cast<int>(kMinLogLevel)) return;

    // 3. Format all arguments in the message
    std::string message = formatString(format, args...);

    // 4. Call the platform specific log function
    nativeLog(level, tag, message);
#endif
  }

  static void nativeLog(LogLevel level, const char* NON_NULL tag, const std::string& string);

private:
  template <typename... Args>
  static std::string formatString(const char* NON_NULL format, Args... args) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wformat-security"
    int size = snprintf(nullptr, 0, format, args...) + 1; // Extra space for '\0'
    if (size <= 0) {
      return "Error during formatting.";
    }
    std::unique_ptr<char[]> buf(new char[size]);
    snprintf(buf.get(), size, format, args...);
    return std::string(buf.get(), buf.get() + size - 1); // We don't want the '\0' inside
#pragma clang diagnostic pop
  }

  // Overloaded functions to convert std::string to C-style string
  template <typename T>
  static constexpr bool is_trivially_copyable() {
    return std::is_trivially_copyable<T>::value;
  }

  template <typename... Args>
  static constexpr bool all_are_trivially_copyable() {
    return (is_trivially_copyable<Args>() && ...);
  }
};

} // namespace margelo::nitro
