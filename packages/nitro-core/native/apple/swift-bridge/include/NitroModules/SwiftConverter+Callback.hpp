#pragma once

#include <NitroModules/Callback.hpp>
#include <NitroModules/InlineCallback.hpp>
#include <NitroModules/SwiftConverter.hpp>

namespace margelo::nitro {

// Match the source signature's value/reference convention.
template <typename T>
using SwiftCallbackArgument = std::conditional_t<std::is_reference_v<T>, const typename SwiftConverter<std::remove_cvref_t<T>>::SwiftType&,
                                                 typename SwiftConverter<std::remove_cvref_t<T>>::SwiftType>;

template <typename CppCallback, typename SwiftCallback>
struct SwiftCallbackConverter;

template <typename R, typename... Args, typename SwiftResult, typename... SwiftArgs>
struct SwiftCallbackConverter<Callback<R(Args...)>, Callback<SwiftResult(SwiftArgs...)>> {
  using CppType = Callback<R(Args...)>;
  using SwiftType = Callback<SwiftResult(SwiftArgs...)>;

  static CppType fromSwift(const SwiftType& value) {
    if constexpr (std::is_same_v<CppType, SwiftType>) {
      return value;
    } else {
      if (auto* nativeCallback = std::get_if<typename SwiftType::NativeCallback>(&value._impl)) {
        return CppType::make([callback = *nativeCallback](Args... args) -> R {
          if constexpr (std::is_void_v<R>) {
            callback(SwiftConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<SwiftArgs>>::toSwift(args)...);
          } else {
            return SwiftConverter<R, SwiftResult>::fromSwift(
                callback(SwiftConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<SwiftArgs>>::toSwift(args)...));
          }
        });
      } else {
        // The new signature uses its own JSIConverters for the same JS function.
        const auto& callback = std::get<typename SwiftType::JSCallback>(value._impl);
        return CppType(typename CppType::JSCallback(callback._runtime, BorrowingReference(callback._function), callback._dispatcher));
      }
    }
  }

  static SwiftType toSwift(const CppType& value) {
    if constexpr (std::is_same_v<CppType, SwiftType>) {
      return value;
    } else {
      if (auto* nativeCallback = std::get_if<typename CppType::NativeCallback>(&value._impl)) {
        return SwiftType::make([callback = *nativeCallback](SwiftArgs... args) -> SwiftResult {
          if constexpr (std::is_void_v<SwiftResult>) {
            callback(SwiftConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<SwiftArgs>>::fromSwift(args)...);
          } else {
            return SwiftConverter<R, SwiftResult>::toSwift(
                callback(SwiftConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<SwiftArgs>>::fromSwift(args)...));
          }
        });
      } else {
        const auto& callback = std::get<typename CppType::JSCallback>(value._impl);
        return SwiftType(typename SwiftType::JSCallback(callback._runtime, BorrowingReference(callback._function), callback._dispatcher));
      }
    }
  }
};

template <typename R, typename... Args, typename SwiftResult, typename... SwiftArgs>
struct SwiftCallbackConverter<InlineCallback<R(Args...)>, Callback<SwiftResult(SwiftArgs...)>> {
  using CppType = InlineCallback<R(Args...)>;
  using SwiftType = Callback<SwiftResult(SwiftArgs...)>;

  static SwiftType toSwift(const CppType& value) {
    // An owning Swift representation must retain the inline callback.
    return SwiftCallbackConverter<Callback<R(Args...)>, SwiftType>::toSwift(value.escape());
  }
};

template <typename R, typename... Args, typename SwiftResult, typename... SwiftArgs>
struct SwiftCallbackConverter<InlineCallback<R(Args...)>, InlineCallback<SwiftResult(SwiftArgs...)>> {
  using CppType = InlineCallback<R(Args...)>;
  using SwiftType = InlineCallback<SwiftResult(SwiftArgs...)>;

  // A matching signature borrows the callback. Otherwise the converted callback lives until the call returns.
  static decltype(auto) toSwift(const CppType& value) {
    if constexpr (std::is_same_v<CppType, SwiftType>) {
      return (value);
    } else {
      if (auto* nativeCallback = std::get_if<typename CppType::NativeCallback>(&value._impl)) {
        // Copy the function, since Swift may escape the converted callback.
        return SwiftType::make([callback = *nativeCallback](SwiftArgs... args) -> SwiftResult {
          if constexpr (std::is_void_v<SwiftResult>) {
            callback(SwiftConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<SwiftArgs>>::fromSwift(args)...);
          } else {
            return SwiftConverter<R, SwiftResult>::toSwift(
                callback(SwiftConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<SwiftArgs>>::fromSwift(args)...));
          }
        });
      } else {
        // The new signature uses its own JSIConverters for the same JS function.
        const auto& callback = std::get<typename CppType::JSCallback>(value._impl);
        jsi::Runtime& runtime = callback._runtime;
        jsi::Function function = jsi::Value(runtime, callback._function).getObject(runtime).getFunction(runtime);
        return SwiftType::make(runtime, std::move(function));
      }
    }
  }
};

// Automatically select the Swift callback signature from the arguments' and result's default converters,
// e.g. Callback<std::string(double)> -> Callback<swift::String(double)>.
template <typename R, typename... Args>
  requires requires { typename SwiftConverter<R>::SwiftType; } &&
           (requires { typename SwiftConverter<std::remove_cvref_t<Args>>::SwiftType; } && ...)
struct SwiftConverter<Callback<R(Args...)>> final
    : SwiftCallbackConverter<Callback<R(Args...)>, Callback<typename SwiftConverter<R>::SwiftType(SwiftCallbackArgument<Args>...)>> {};

template <typename R, typename... Args>
  requires requires { typename SwiftConverter<R>::SwiftType; } &&
           (requires { typename SwiftConverter<std::remove_cvref_t<Args>>::SwiftType; } && ...)
struct SwiftConverter<InlineCallback<R(Args...)>> final
    : SwiftCallbackConverter<InlineCallback<R(Args...)>, Callback<typename SwiftConverter<R>::SwiftType(SwiftCallbackArgument<Args>...)>> {};

template <typename R, typename... Args, typename SwiftResult, typename... SwiftArgs>
struct SwiftConverter<Callback<R(Args...)>, Callback<SwiftResult(SwiftArgs...)>> final
    : SwiftCallbackConverter<Callback<R(Args...)>, Callback<SwiftResult(SwiftArgs...)>> {};

template <typename R, typename... Args, typename SwiftResult, typename... SwiftArgs>
struct SwiftConverter<InlineCallback<R(Args...)>, Callback<SwiftResult(SwiftArgs...)>> final
    : SwiftCallbackConverter<InlineCallback<R(Args...)>, Callback<SwiftResult(SwiftArgs...)>> {};

template <typename R, typename... Args, typename SwiftResult, typename... SwiftArgs>
struct SwiftConverter<InlineCallback<R(Args...)>, InlineCallback<SwiftResult(SwiftArgs...)>> final
    : SwiftCallbackConverter<InlineCallback<R(Args...)>, InlineCallback<SwiftResult(SwiftArgs...)>> {};

} // namespace margelo::nitro
