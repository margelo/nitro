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
  // Do not use `std::make_exception_ptr` here: when this inline function is emitted through the
  // Swift C++ interop build with Xcode 27, it references `std::exception_ptr::__from_native_exception_pointer`,
  // a libc++ symbol that only exists on iOS 18+. Apps that still support iOS < 18 then crash at launch
  // in dyld with "Symbol not found". The throw/catch fallback only needs `std::current_exception`,
  // which is available on every supported iOS version.
  // See https://github.com/margelo/nitro/issues/1652
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
