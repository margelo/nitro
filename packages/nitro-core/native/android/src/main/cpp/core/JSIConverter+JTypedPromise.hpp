#pragma once

#include "JSIConverter+JNIGlobalRef.hpp"
#include "JTypedPromise.hpp"
#include "JUnit.hpp"
#include <NitroModules/JSIConverter+Promise.hpp>
#include <utility>

namespace margelo::nitro {

template <typename JNIResult>
struct JSIConverter<jni::local_ref<JTypedPromise<JNIResult>>> final {
  using JavaPromise = JTypedPromise<JNIResult>;
  using Result = typename detail::JNIPromiseResult<JNIResult>::Stored;

  static jni::local_ref<JavaPromise> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires(std::is_void_v<Result> || JSIDecodable<Result>)
  {
    // The JS Promise's native listeners own these, and the JS engine may destroy them on any thread.
    auto nativePromise = JSIConverter<Promise<Result>>::fromJSI(runtime, value);
    auto javaPromise = JavaPromise::create();
    auto owner = makeSharedGlobalRef(jni::make_global(javaPromise));
    if constexpr (std::is_void_v<Result>) {
      nativePromise.addOnResolvedListener([owner] { (*owner)->cthis()->resolve(JUnit::instance()); });
    } else {
      nativePromise.addOnResolvedListener([owner](const Result& result) { (*owner)->cthis()->resolve(*result); });
    }
    // Destroying the pending native Promise, e.g. on the JS engine's GC thread, rejects it.
    nativePromise.addOnRejectedListener(
        [owner](const std::exception_ptr& error) { runAttached([&] { (*owner)->cthis()->reject(error); }); });
    return javaPromise;
  }

  static jsi::Value toJSI(jsi::Runtime& runtime, jni::alias_ref<JavaPromise> value)
    requires(std::is_void_v<Result> || JSIEncodable<Result>)
  {
    auto nativePromise = Promise<Result>::pending();
    const auto state = value->cthis()->getPromise();
    state.addOnResolvedListener([nativePromise](const JPromise::ResultType& result) {
      if constexpr (std::is_void_v<JNIResult>) {
        nativePromise.resolve();
      } else {
        using JavaResult = typename detail::JNIPromiseResult<JNIResult>::JavaClass;
        auto object = jni::alias_ref<jni::JObject>(result);
        auto typedResult = jni::static_ref_cast<JavaResult>(object);
        nativePromise.resolve(makeSharedGlobalRef<JavaResult>(jni::make_global(typedResult)));
      }
    });
    state.addOnRejectedListener([nativePromise](const std::exception_ptr& error) { nativePromise.reject(std::exception_ptr(error)); });
    return JSIConverter<Promise<Result>>::toJSI(runtime, nativePromise);
  }

  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    return JSIConverter<Promise<Result>>::canConvert(runtime, value);
  }
};

} // namespace margelo::nitro
