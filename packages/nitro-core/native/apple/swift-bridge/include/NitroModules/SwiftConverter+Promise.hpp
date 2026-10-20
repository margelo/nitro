#pragma once

#include <NitroModules/Promise.hpp>
#include <NitroModules/SwiftConverter.hpp>

namespace margelo::nitro {

template <typename T, typename SwiftValue>
struct SwiftPromiseConverter {
  using SwiftType = Promise<SwiftValue>;

  static Promise<T> fromSwift(const SwiftType& value) {
    return convert<Promise<T>>(value, SwiftConverter<T, SwiftValue>::fromSwift);
  }

  static SwiftType toSwift(const Promise<T>& value) {
    return convert<SwiftType>(value, SwiftConverter<T, SwiftValue>::toSwift);
  }

private:
  template <typename Output, typename Input, typename Convert>
  static Output convert(const Input& input, Convert convertValue) {
    if constexpr (std::is_same_v<Output, Input>) {
      return input;
    } else {
      auto result = Output::pending();
      input.addOnResolvedListener([result, convertValue](const auto& value) {
        result.resolve(convertValue(value));
      });
      input.addOnRejectedListener([result](const std::exception_ptr& error) { result.reject(std::exception_ptr(error)); });
      return result;
    }
  }
};

template <>
struct SwiftPromiseConverter<void, void> {
  using SwiftType = Promise<void>;

  static SwiftType fromSwift(const SwiftType& value) {
    return value;
  }
  static SwiftType toSwift(const SwiftType& value) {
    return value;
  }
};

// Automatically select the Swift promise type from the result's default converter,
// e.g. Promise<std::string> -> Promise<swift::String>.
template <typename T>
  requires requires { typename SwiftConverter<T>::SwiftType; }
struct SwiftConverter<Promise<T>> final : SwiftPromiseConverter<T, typename SwiftConverter<T>::SwiftType> {};

template <typename T, typename SwiftValue>
struct SwiftConverter<Promise<T>, Promise<SwiftValue>> final : SwiftPromiseConverter<T, SwiftValue> {};

} // namespace margelo::nitro
