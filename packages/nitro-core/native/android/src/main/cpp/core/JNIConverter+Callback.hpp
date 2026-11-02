#pragma once

#include "JNICallback.hpp"
#include "JTypedCallback.hpp"

namespace margelo::nitro {

template <typename CppCallback, typename JavaCallback>
struct JNICallbackConverter;

template <typename CppResult, typename... CppArgs, typename JavaResult, typename... JavaArgs>
struct JNICallbackConverter<Callback<CppResult(CppArgs...)>, Callback<JavaResult(JavaArgs...)>> {
  using Cpp = Callback<CppResult(CppArgs...)>;
  using Java = Callback<JavaResult(JavaArgs...)>;
  static Cpp fromJNI(const Java& value) {
    if constexpr (std::is_same_v<Cpp, Java>) {
      return value;
    } else if (auto* native = std::get_if<typename Java::NativeCallback>(&value._impl)) {
      return Cpp::make([callback = *native](CppArgs... args) -> CppResult {
        if constexpr (std::is_void_v<CppResult>) {
          callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::toJNI(args)...);
        } else {
          return JNIConverter<CppResult, JavaResult>::fromJNI(
              callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::toJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Java::JSCallback>(value._impl);
      return Cpp(typename Cpp::JSCallback(callback._runtime, BorrowingReference(callback._function), callback._dispatcher));
    }
  }
  static Java toJNI(const Cpp& value) {
    if constexpr (std::is_same_v<Cpp, Java>) {
      return value;
    } else if (auto* native = std::get_if<typename Cpp::NativeCallback>(&value._impl)) {
      return Java::make([callback = *native](JavaArgs... args) -> JavaResult {
        if constexpr (std::is_void_v<JavaResult>) {
          callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::fromJNI(args)...);
        } else {
          return JNIConverter<CppResult, JavaResult>::toJNI(
              callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::fromJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Cpp::JSCallback>(value._impl);
      return Java(typename Java::JSCallback(callback._runtime, BorrowingReference(callback._function), callback._dispatcher));
    }
  }
};

template <typename CppResult, typename... CppArgs, typename JavaResult, typename... JavaArgs>
struct JNICallbackConverter<InlineCallback<CppResult(CppArgs...)>, InlineCallback<JavaResult(JavaArgs...)>> {
  using Cpp = InlineCallback<CppResult(CppArgs...)>;
  using Java = InlineCallback<JavaResult(JavaArgs...)>;
  static decltype(auto) toJNI(const Cpp& value) {
    if constexpr (std::is_same_v<Cpp, Java>) {
      return (value);
    } else if (auto* native = std::get_if<typename Cpp::NativeCallback>(&value._impl)) {
      return Java::make([callback = *native](JavaArgs... args) -> JavaResult {
        if constexpr (std::is_void_v<JavaResult>) {
          callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::fromJNI(args)...);
        } else {
          return JNIConverter<CppResult, JavaResult>::toJNI(
              callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::fromJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Cpp::JSCallback>(value._impl);
      jsi::Runtime& runtime = callback._runtime;
      jsi::Function function = jsi::Value(runtime, callback._function).getObject(runtime).getFunction(runtime);
      return Java::make(runtime, std::move(function));
    }
  }
  static decltype(auto) fromJNI(const Java& value) {
    if constexpr (std::is_same_v<Cpp, Java>) {
      return (value);
    } else if (auto* native = std::get_if<typename Java::NativeCallback>(&value._impl)) {
      return Cpp::make([callback = *native](CppArgs... args) -> CppResult {
        if constexpr (std::is_void_v<CppResult>) {
          callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::toJNI(args)...);
        } else {
          return JNIConverter<CppResult, JavaResult>::fromJNI(
              callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::toJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Java::JSCallback>(value._impl);
      jsi::Runtime& runtime = callback._runtime;
      jsi::Function function = jsi::Value(runtime, callback._function).getObject(runtime).getFunction(runtime);
      return Cpp::make(runtime, std::move(function));
    }
  }
};

template <typename CppResult, typename... CppArgs, typename JavaResult, typename... JavaArgs>
struct JNIConverter<Callback<CppResult(CppArgs...)>, Callback<JavaResult(JavaArgs...)>>
    : JNICallbackConverter<Callback<CppResult(CppArgs...)>, Callback<JavaResult(JavaArgs...)>> {};

template <typename CppResult, typename... CppArgs, typename JavaResult, typename... JavaArgs>
struct JNIConverter<InlineCallback<CppResult(CppArgs...)>, InlineCallback<JavaResult(JavaArgs...)>>
    : JNICallbackConverter<InlineCallback<CppResult(CppArgs...)>, InlineCallback<JavaResult(JavaArgs...)>> {};

template <typename CppResult, typename... CppArgs, typename JavaResult, typename... JavaArgs>
struct JNICallbackConverter<InlineCallback<CppResult(CppArgs...)>, Callback<JavaResult(JavaArgs...)>> {
  using Cpp = InlineCallback<CppResult(CppArgs...)>;
  using Java = Callback<JavaResult(JavaArgs...)>;

  static Java toJNI(const Cpp& value) {
    return JNICallbackConverter<Callback<CppResult(CppArgs...)>, Java>::toJNI(value.escape());
  }

  static Cpp fromJNI(const Java& value) {
    if (auto* native = std::get_if<typename Java::NativeCallback>(&value._impl)) {
      return Cpp::make([callback = *native](CppArgs... args) -> CppResult {
        if constexpr (std::is_void_v<CppResult>) {
          callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::toJNI(args)...);
        } else {
          return JNIConverter<CppResult, JavaResult>::fromJNI(
              callback(JNIConverter<std::remove_cvref_t<CppArgs>, std::remove_cvref_t<JavaArgs>>::toJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Java::JSCallback>(value._impl);
      jsi::Runtime& runtime = callback._runtime;
      jsi::Function function = jsi::Value(runtime, *callback._function).getObject(runtime).getFunction(runtime);
      return Cpp::make(runtime, std::move(function));
    }
  }
};

/** Converts a C++ callback to and from a Kotlin `Callback<...>`. */
template <typename CppResult, typename... CppArgs, typename JavaCallback>
struct JNIConverter<Callback<CppResult(CppArgs...)>, jni::local_ref<JTypedCallback<JavaCallback>>> {
  using Cpp = Callback<CppResult(CppArgs...)>;
  using KotlinCallback = JTypedCallback<JavaCallback>;
  using NativeCallback = typename JavaCallback::HybridType::CallbackType;

  static jni::local_ref<KotlinCallback> toJNI(const Cpp& value) {
    return KotlinCallback::create(JNICallbackConverter<Cpp, NativeCallback>::toJNI(value));
  }

  static Cpp fromJNI(jni::alias_ref<KotlinCallback> value) {
    return JNICallbackConverter<Cpp, NativeCallback>::fromJNI(value->getCallback());
  }
};

/** Kotlin cannot borrow a callback, so an `InlineCallback` escapes into a Kotlin `Callback<...>`. */
template <typename CppResult, typename... CppArgs, typename JavaCallback>
struct JNIConverter<InlineCallback<CppResult(CppArgs...)>, jni::local_ref<JTypedCallback<JavaCallback>>> {
  using Cpp = InlineCallback<CppResult(CppArgs...)>;
  using KotlinCallback = JTypedCallback<JavaCallback>;
  using NativeCallback = typename JavaCallback::HybridType::CallbackType;

  static jni::local_ref<KotlinCallback> toJNI(const Cpp& value) {
    return KotlinCallback::create(JNICallbackConverter<Cpp, NativeCallback>::toJNI(value));
  }

  static Cpp fromJNI(jni::alias_ref<KotlinCallback> value) {
    return JNICallbackConverter<Cpp, NativeCallback>::fromJNI(value->getCallback());
  }
};

} // namespace margelo::nitro
