//
//  JHybridObject.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 14.07.24.
//

#pragma once

#include "HybridObject.hpp"
#include <fbjni/fbjni.h>

namespace margelo::nitro {

using namespace facebook;

/**
 * Bridges a Java `HybridObject` instance over to C++.
 * - JavaPart: The actual Java Class (HybridObject) - this will be held by `JHybridObject`
 * - CxxPart: The nested Java CxxPart (HybridObject.CxxPart) - this builds the proper inheritance chain and caches C++ state
 */
class JHybridObject : public virtual HybridObject {
public:
  struct JavaPart : jni::JavaClass<JavaPart> {
    static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/HybridObject;";
    std::shared_ptr<JHybridObject> getJHybridObject();
  };
  struct CxxPart : jni::HybridClass<CxxPart> {
    static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/core/HybridObject$CxxPart;";
    static jni::local_ref<jhybriddata> initHybrid(jni::alias_ref<jhybridobject> cxxJavaPart);
    static void registerNatives();
    explicit CxxPart(jni::alias_ref<jhybridobject> cxxJavaPart);
    std::shared_ptr<JHybridObject> getOrCreateHybridObject(const jni::local_ref<JHybridObject::JavaPart>& javaPart);

  protected:
    /**
     * Override this method in your Class' CxxPart to allow type-erased inheritance.
     */
    virtual std::shared_ptr<JHybridObject> createHybridObject(const jni::local_ref<JHybridObject::JavaPart>& javaPart);

  private:
    std::weak_ptr<JHybridObject> _hybridObject;
  };

public:
  explicit JHybridObject(const jni::local_ref<JavaPart>& javaPart);
  ~JHybridObject() override;

public:
  void dispose() noexcept override;
  bool equals(const std::shared_ptr<HybridObject>& other) override;
  size_t getExternalMemorySize() noexcept override;
  std::string toString() override;

private:
  jni::global_ref<JavaPart> _javaPart;
};

} // namespace margelo::nitro
