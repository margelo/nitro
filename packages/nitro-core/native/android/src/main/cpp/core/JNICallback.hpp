#pragma once

#include "JCxxCallback.hpp"
#include "JNIConverter+GlobalRef.hpp"
#include "JNIConverter+Promise.hpp"
#include "JSIConverter+JNIGlobalRef.hpp"
#include <NitroModules/Callback.hpp>
#include <NitroModules/InlineCallback.hpp>
#include <optional>
#include <variant>

namespace margelo::nitro {

/** JNI values retained by an escapable callback; primitives need no reference.
 */
template <typename T>
struct JNIRetainedValue {
  using Type = T;
  using Borrowed = T;
  using Local = T;
  static Type retain(T value) {
    return value;
  }
  static T borrow(T value) {
    return value;
  }
  static T toLocal(T value) {
    return value;
  }
};

template <typename T>
struct JNIRetainedValue<jni::local_ref<T>> {
  using Type = jni::global_ref<T>;
  using Borrowed = jni::alias_ref<T>;
  using Local = jni::local_ref<T>;
  static Type retain(Borrowed value) {
    return jni::make_global(value);
  }
  static Borrowed borrow(const Type& value) {
    return value;
  }
  static jni::local_ref<T> toLocal(const Type& value) {
    return jni::make_local(value);
  }
};

template <>
struct JNIRetainedValue<void> {
  using Type = void;
  using Local = void;
};

template <typename CppCallback, typename JavaCallback>
struct JNICallbackConverter;

/** Reads and creates JS callbacks of any signature, because their JS function is untyped. */
template <typename R, typename... Args>
struct JNICallbackConverter<Callback<R(Args...)>, JSCallbackFunction> {
  using Cpp = Callback<R(Args...)>;

  static std::optional<JSCallbackFunction> toJSFunction(const Cpp& value) {
    const auto* callback = std::get_if<typename Cpp::JSCallback>(&value._impl);
    if (callback == nullptr) {
      return std::nullopt;
    }
    return JSCallbackFunction{callback->_runtime, callback->_function, callback->_dispatcher};
  }

  static Cpp fromJSFunction(const JSCallbackFunction& value) {
    return Cpp(typename Cpp::JSCallback(value.runtime, BorrowingReference(value.function), value.dispatcher));
  }
};

template <typename Signature>
class JNICallbackState;

/**
 * The C++ `Callback` of a generated Kotlin callback class, called with JNI values.
 * Arguments are retained, because `callAsync` and `callAndForget` use them later on the JS thread.
 */
template <typename R, typename... Args>
class JNICallbackState<R(Args...)> final {
public:
  using Signature = typename JNIRetainedValue<R>::Type(typename JNIRetainedValue<Args>::Type...);
  using CallbackType = Callback<Signature>;

  explicit JNICallbackState(CallbackType callback) : _callback(std::move(callback)) {}

  typename JNIRetainedValue<R>::Local callSync(typename JNIRetainedValue<Args>::Borrowed... args) const {
    // Calling the callback can reentrantly release this callback's HybridData.
    const auto callback = _callback;
    if constexpr (std::is_void_v<R>) {
      callback.callSync(JNIRetainedValue<Args>::retain(args)...);
    } else {
      return JNIRetainedValue<R>::toLocal(callback.callSync(JNIRetainedValue<Args>::retain(args)...));
    }
  }

  template <typename JavaPromise>
  jni::local_ref<JavaPromise> callAsync(typename JNIRetainedValue<Args>::Borrowed... args) const {
    const auto callback = _callback;
    Promise<typename JNIRetainedValue<R>::Type> promise = callback.callAsync(JNIRetainedValue<Args>::retain(args)...);
    return JNIConverter<Promise<typename JNIRetainedValue<R>::Type>, jni::local_ref<JavaPromise>>::toJNI(promise);
  }

  void callAndForget(typename JNIRetainedValue<Args>::Borrowed... args) const {
    const auto callback = _callback;
    callback.callAndForget(JNIRetainedValue<Args>::retain(args)...);
  }

  const CallbackType& getCallback() const {
    return _callback;
  }

  std::optional<JSCallbackFunction> getJSFunction() const {
    return JNICallbackConverter<CallbackType, JSCallbackFunction>::toJSFunction(_callback);
  }

  static CallbackType fromJSFunction(const JSCallbackFunction& function) {
    return JNICallbackConverter<CallbackType, JSCallbackFunction>::fromJSFunction(function);
  }

private:
  CallbackType _callback;
};

/** Obtain the C++ `Callback` held by a generated Kotlin callback class. */
template <typename JavaCallback>
Callback<typename JavaCallback::HybridType::NativeSignature> getJNICallback(jni::alias_ref<JavaCallback> value) {
  return value->cthis()->getCallback();
}

} // namespace margelo::nitro
