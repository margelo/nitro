#pragma once

#include "JNIConverter+Primitives.hpp"
#include <type_traits>
#include <vector>

namespace margelo::nitro {

template <typename CppElement, typename JavaArray>
  requires(jni::IsInstantiationOf<jni::JPrimitiveArray, JavaArray>())
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
