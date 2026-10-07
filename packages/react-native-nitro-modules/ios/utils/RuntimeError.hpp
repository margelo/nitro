//
//  RuntimeError.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 19.11.24.
//

#pragma once

#include "NitroTypeInfo.hpp"
#include <exception>
#include <string>

namespace margelo::nitro {

static inline std::exception_ptr makeException(const std::string& message) {
  try {
    throw std::runtime_error(message);
  } catch (...) {
    return std::current_exception();
  }
}

static inline std::string getExceptionMessage(const std::exception_ptr& exception) {
  if (exception == nullptr) [[unlikely]] {
    throw std::runtime_error("Cannot get error message of a nullptr exception_ptr!");
  }

  try {
    std::rethrow_exception(exception);
  } catch (const std::exception& error) {
    return error.what();
  } catch (...) {
    std::string errorName = TypeInfo::getCurrentExceptionName();
    return "Unknown " + errorName + " exception";
  }
}

} // namespace margelo::nitro
