#pragma once

#include "JNIConverter.hpp"
#include "JTypedPromise.hpp"
#include "JUnit.hpp"

namespace margelo::nitro {

template <typename CppResult, typename JavaResult>
struct JNIConverter<Promise<CppResult>, jni::local_ref<JTypedPromise<JavaResult>>> {
  using JavaPromise = JTypedPromise<JavaResult>;

  static jni::local_ref<JavaPromise> toJNI(const Promise<CppResult>& value) {
    auto promise = JavaPromise::create();
    // The native Promise's listeners own this, and the JS engine may destroy them on any thread.
    auto owner = makeSharedGlobalRef(jni::make_global(promise));
    if constexpr (std::is_void_v<CppResult>) {
      static_assert(std::is_void_v<JavaResult>);
      value.addOnResolvedListener([owner] { (*owner)->cthis()->resolve(JUnit::instance()); });
    } else {
      value.addOnResolvedListener([owner](const CppResult& result) {
        try {
          JavaResult converted = JNIConverter<CppResult, JavaResult>::toJNI(result);
          (*owner)->cthis()->resolve(converted);
        } catch (...) {
          (*owner)->cthis()->reject(std::current_exception());
        }
      });
    }
    // Destroying the pending native Promise, e.g. on the JS engine's GC thread, rejects it.
    value.addOnRejectedListener([owner](const std::exception_ptr& error) { runAttached([&] { (*owner)->cthis()->reject(error); }); });
    return promise;
  }

  static Promise<CppResult> fromJNI(jni::alias_ref<JavaPromise> value) {
    auto promise = Promise<CppResult>::pending();
    const auto state = value->cthis()->getPromise();
    if constexpr (std::is_void_v<CppResult>) {
      static_assert(std::is_void_v<JavaResult>);
      state.addOnResolvedListener([promise](const JPromise::ResultType&) { promise.resolve(); });
    } else {
      state.addOnResolvedListener([promise](const JPromise::ResultType& result) {
        try {
          using JavaClass = typename detail::JNIPromiseResult<JavaResult>::JavaClass;
          auto object = jni::alias_ref<jni::JObject>(result);
          auto typedResult = jni::static_ref_cast<JavaClass>(object);
          CppResult converted = JNIConverter<CppResult, JavaResult>::fromJNI(typedResult);
          promise.resolve(std::move(converted));
        } catch (...) {
          promise.reject(std::current_exception());
        }
      });
    }
    state.addOnRejectedListener([promise](const std::exception_ptr& error) { promise.reject(std::exception_ptr(error)); });
    return promise;
  }
};

} // namespace margelo::nitro
