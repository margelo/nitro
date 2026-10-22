#pragma once

#include "JCxxCallback.hpp"
#include "JNIConverter+GlobalRef.hpp"
#include "JNIConverter+Promise.hpp"
#include "JSIConverter+JNIGlobalRef.hpp"
#include <NitroModules/Callback.hpp>
#include <NitroModules/InlineCallback.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <cassert>
#include <cstring>
#include <typeinfo>

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

template <typename Signature>
class JNICallback;

/**
 * The C++ part of every generated Kotlin callback class with this signature. It holds a `Callback`
 * with JNI values, and retains arguments because `callAsync` and `callAndForget` use them later on the JS thread.
 *
 * Each module generates its own class for a signature, but all of them derive from this template,
 * so a module can use the `Callback` of another module's callback with the same signature.
 */
template <typename R, typename... Args>
class JNICallback<R(Args...)> : public jni::HybridClass<JNICallback<R(Args...)>, JCxxCallback> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/CxxCallback;";
  using NativeSignature = typename JNIRetainedValue<R>::Type(typename JNIRetainedValue<Args>::Type...);
  using CallbackType = Callback<NativeSignature>;

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

  /** The `Callback` of a generated callback class with this signature, from any module. */
  static const CallbackType& getCallback(jni::alias_ref<JCxxCallback::javaobject> callback) {
    const JCxxCallback* base = callback->cthis();
#ifdef NITRO_DEBUG
    // Kotlin only passes a callback of another signature through an unchecked cast. Each module has its
    // own type info for a template instance, so compare the names instead of the type info.
    assert(std::strcmp(base->getCallbackType().name(), typeid(CallbackType).name()) == 0 &&
           "A Kotlin callback was passed as a Callback of another signature!");
#endif
    return static_cast<const JNICallback*>(base)->getCallback();
  }

  const std::type_info& getCallbackType() const override {
    return typeid(CallbackType);
  }

protected:
  explicit JNICallback(CallbackType callback) : _callback(std::move(callback)) {}

private:
  CallbackType _callback;
};

/** Obtain the C++ `Callback` held by a generated Kotlin callback class. */
template <typename JavaCallback>
Callback<typename JavaCallback::HybridType::NativeSignature> getJNICallback(jni::alias_ref<JavaCallback> value) {
  return value->cthis()->getCallback();
}

} // namespace margelo::nitro
