#pragma once

#include "JSIConverter+JNIPrimitives.hpp"
#include <NitroModules/JSIArrayHelpers.hpp>
#include <algorithm>
#include <array>

namespace margelo::nitro {

template <typename JavaArray>
  requires(jni::IsInstantiationOf<jni::JPrimitiveArray, JavaArray>())
struct JSIConverter<jni::local_ref<JavaArray>> {
  using Primitive = typename JavaArray::T;
  using Element = Primitive;

  static jni::local_ref<JavaArray> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSIDecodable<Element>
  {
    auto array = value.asObject(runtime).asArray(runtime);
    const jsize size = static_cast<jsize>(array.size(runtime));
    auto result = JavaArray::newArray(size);
    // Fill bounded regions without first reading the new Java array's zeroed storage.
    constexpr jsize capacity = 256;
    std::array<Primitive, capacity> elements;
    for (jsize start = 0; start < size;) {
      const jsize count = std::min(capacity, size - start);
      for (jsize i = 0; i < count; ++i) {
        elements[i] =
            JNIConverter<Element, Primitive>::toJNI(JSIConverter<Element>::fromJSI(runtime, array.getValueAtIndex(runtime, start + i)));
      }
      result->setRegion(start, count, elements.data());
      start += count;
    }
    return result;
  }
  static jsi::Array toJSI(jsi::Runtime& runtime, jni::alias_ref<JavaArray> value)
    requires JSIEncodable<Element>
  {
    const size_t size = value->size();
    if (size == 0) {
      return jsi::Array(runtime, 0);
    }
    // Region reads do not copy unchanged values back to the Java array.
    constexpr size_t capacity = 256;
    std::array<Primitive, capacity> elements;
    size_t start = 0;
    size_t end = 0;
    return createJSIArray(runtime, size, [&](size_t i) {
      if (i == end) {
        start = i;
        const size_t count = std::min(capacity, size - i);
        value->getRegion(static_cast<jsize>(start), static_cast<jsize>(count), elements.data());
        end = start + count;
      }
      return JSIConverter<Element>::toJSI(runtime, JNIConverter<Element, Primitive>::fromJNI(elements[i - start]));
    });
  }
  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSITypeCheckable<Element>
  {
    return canConvertJSIArray(runtime, value,
                              [&](const jsi::Value& element) { return JSIConverter<Element>::canConvert(runtime, element); });
  }
};

} // namespace margelo::nitro
