#pragma once

#include "JNIGlobalRef.hpp"
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/detail/CountTrailingOptionals.hpp>
#include <fbjni/fbjni.h>

namespace margelo::nitro {

namespace jni = facebook::jni;

namespace detail {
  template <typename T>
  struct is_optional<jni::global_ref<T>> : is_optional<jni::local_ref<T>> {};
} // namespace detail

template <typename T>
struct JSIConverter<jni::global_ref<T>> final {
  using LocalRef = jni::local_ref<T>;

  static jni::global_ref<T> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSIDecodable<LocalRef>
  {
    return jni::make_global(JSIConverter<LocalRef>::fromJSI(runtime, value));
  }

  static jsi::Value toJSI(jsi::Runtime& runtime, jni::alias_ref<T> value)
    requires JSIEncodable<LocalRef>
  {
    return JSIConverter<LocalRef>::toJSI(runtime, value);
  }

  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSITypeCheckable<LocalRef>
  {
    return JSIConverter<LocalRef>::canConvert(runtime, value);
  }
};

template <typename T>
struct JSIConverter<SharedGlobalRef<T>> final {
  using GlobalRef = jni::global_ref<T>;

  static SharedGlobalRef<T> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSIDecodable<GlobalRef>
  {
    return makeSharedGlobalRef(JSIConverter<GlobalRef>::fromJSI(runtime, value));
  }

  static jsi::Value toJSI(jsi::Runtime& runtime, const SharedGlobalRef<T>& value)
    requires JSIEncodable<const GlobalRef&>
  {
    return JSIConverter<GlobalRef>::toJSI(runtime, *value);
  }

  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSITypeCheckable<GlobalRef>
  {
    return JSIConverter<GlobalRef>::canConvert(runtime, value);
  }
};

} // namespace margelo::nitro
