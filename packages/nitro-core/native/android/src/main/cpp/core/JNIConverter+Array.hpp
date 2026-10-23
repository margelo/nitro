#pragma once

#include "JNIConverter+Primitives.hpp"
#include <concepts>
#include <type_traits>
#include <vector>

namespace margelo::nitro {

template <typename CppElement, typename JavaArray>
  requires(jni::IsInstantiationOf<jni::JPrimitiveArray, JavaArray>() ||
           (std::same_as<JavaArray, JArrayUInt64> && std::same_as<CppElement, uint64_t>))
struct JNIConverter<std::vector<CppElement>, jni::local_ref<JavaArray>> {
  using Primitive = typename JavaArray::T;

  static jni::local_ref<JavaArray> toJNI(const std::vector<CppElement>& value) {
    const jsize size = static_cast<jsize>(value.size());
    auto array = JavaArray::newArray(size);
    if (size != 0) {
      if constexpr (std::is_same_v<CppElement, Primitive>) {
        array->setRegion(0, size, value.data());
      } else {
        auto elements = array->pin();
        for (jsize i = 0; i < size; ++i) {
          elements[i] = JNIConverter<CppElement, Primitive>::toJNI(value[i]);
        }
      }
    }
    return array;
  }
  static std::vector<CppElement> fromJNI(jni::alias_ref<JavaArray> value) {
    const jsize size = static_cast<jsize>(value->size());
    if constexpr (std::is_same_v<CppElement, Primitive>) {
      std::vector<CppElement> result(size);
      if (size != 0) {
        value->getRegion(0, size, result.data());
      }
      return result;
    } else {
      std::vector<CppElement> result;
      result.reserve(size);
      if (size != 0) {
        auto elements = value->pin();
        for (jsize i = 0; i < size; ++i) {
          result.push_back(JNIConverter<CppElement, Primitive>::fromJNI(elements[i]));
        }
      }
      return result;
    }
  }
};

template <>
struct JNIConverter<std::vector<uint64_t>, jni::local_ref<JULongArray>> {
  using JavaArray = jni::local_ref<JArrayUInt64>;

  static jni::local_ref<JULongArray> toJNI(const std::vector<uint64_t>& value) {
    auto array = JNIConverter<std::vector<uint64_t>, JavaArray>::toJNI(value);
    return JULongBox::boxArray(array);
  }
  static std::vector<uint64_t> fromJNI(jni::alias_ref<JULongArray> value) {
    auto array = JULongBox::unboxArray(value);
    return JNIConverter<std::vector<uint64_t>, JavaArray>::fromJNI(array);
  }
};

/** Boxes a retained array, e.g. a callback's async result, without copying it. */
template <>
struct JNIConverter<jni::global_ref<JArrayUInt64>, jni::local_ref<JULongArray>> {
  static jni::local_ref<JULongArray> toJNI(const jni::global_ref<JArrayUInt64>& value) {
    return JULongBox::boxArray(value);
  }
  static jni::global_ref<JArrayUInt64> fromJNI(jni::alias_ref<JULongArray> value) {
    return jni::make_global(JULongBox::unboxArray(value));
  }
};

template <typename CppElement, typename JavaElement>
struct JNIConverter<std::vector<CppElement>, jni::local_ref<jni::JArrayClass<JavaElement>>> {
  using JavaArray = jni::JArrayClass<JavaElement>;

  static jni::local_ref<JavaArray> toJNI(const std::vector<CppElement>& value) {
    const jsize size = static_cast<jsize>(value.size());
    auto array = JavaArray::newArray(size);
    for (jsize i = 0; i < size; ++i) {
      auto element = JNIConverter<CppElement, jni::local_ref<JavaElement>>::toJNI(value[i]);
      array->setElement(i, *element);
    }
    return array;
  }
  static std::vector<CppElement> fromJNI(jni::alias_ref<JavaArray> value) {
    const jsize size = static_cast<jsize>(value->size());
    std::vector<CppElement> result;
    result.reserve(size);
    for (jsize i = 0; i < size; ++i) {
      auto element = value->getElement(i);
      result.push_back(JNIConverter<CppElement, jni::local_ref<JavaElement>>::fromJNI(element));
    }
    return result;
  }
};

} // namespace margelo::nitro
