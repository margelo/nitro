//
//  DefaultConstructableObject.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 11.11.24.
//

#pragma once

#include "NitroDefines.hpp"
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

template <typename T>
class DefaultConstructableObject final {
public:
  explicit DefaultConstructableObject(const char* javaClassDescriptor) {
    try {
      // Find JNI class and default constructor
      _javaClass = jni::findClassStatic(javaClassDescriptor);
      _defaultConstructor = _javaClass->getConstructor<T()>();
    } catch (const jni::JniException& exc) {
      std::string message = exc.what();
      std::string descriptor = javaClassDescriptor;
      std::string className = findClassName(descriptor);
      if (message.find("ClassNotFoundException")) {
        // Java class cannot be found
        throw std::runtime_error(
            "Couldn't find class `" + descriptor +
            "`!\n"
            "- Make sure the class exists in the specified namespace.\n"
            "- Make sure the class is not stripped. If you are using ProGuard, add `@Keep` and `@DoNotStrip` annotations to `" +
            className + "`.");
      } else if (message.find("NoSuchMethodError")) {
        // Default Constructor cannot be found
        throw std::runtime_error(
            "Couldn't find " + className +
            "'s default constructor!\n"
            "- If you want to autolink " +
            className +
            ", add a default constructor that takes zero arguments.\n"
            "- If you need arguments to create instances of " +
            className +
            ", create a separate HybridObject that acts as a factory for this HybridObject to create instances of it with parameters.\n"
            "- If you already have a default constructor, make sure it is not being stripped. If you are using ProGuard, add `@Keep` and "
            "`@DoNotStrip` annotations to the default constructor.");
      } else {
        throw;
      }
    }
  }

public:
  jni::local_ref<T> create() const {
    // Calls the class's default constructor
    auto instance = _javaClass->newObject(_defaultConstructor);
#ifdef NITRO_DEBUG
    if (instance == nullptr) [[unlikely]] {
      throw std::runtime_error("Failed to create an instance of \"" + _javaClass->toString() + "\" - the constructor returned null!");
    }
#endif
    return instance;
  }

private:
  static std::string findClassName(const std::string& jniDescriptor) {
    size_t lastSlash = jniDescriptor.rfind('/');
    return jniDescriptor.substr(lastSlash + 1);
  }

private:
  jni::alias_ref<jni::JClass> _javaClass;
  jni::JConstructor<T()> _defaultConstructor;
};

} // namespace margelo::nitro
