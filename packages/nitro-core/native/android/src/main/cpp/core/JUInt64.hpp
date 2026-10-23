#pragma once

#include <fbjni/fbjni.h>

namespace margelo::nitro {

namespace jni = facebook::jni;

/** Java Long storage interpreted as Kotlin ULong's unsigned bits. */
struct JUInt64 : jni::JavaClass<JUInt64, jni::JLong> {
  static constexpr auto kJavaDescriptor = "Ljava/lang/Long;";
};

/** Java long[] storage interpreted as Kotlin ULongArray's unsigned bits. */
struct JArrayUInt64 : jni::JavaClass<JArrayUInt64, jni::JArrayLong> {
  static constexpr const char* kJavaDescriptor = nullptr;

  static jni::local_ref<JArrayUInt64> newArray(size_t size) {
    auto array = jni::JArrayLong::newArray(size);
    auto raw = array.release();
    auto object = static_cast<javaobject>(raw);
    return jni::adopt_local(object);
  }
};

/**
 * A Kotlin ULong in an erased generic, such as a Map value or a Promise result.
 * R8 can rename kotlin.ULong, so JNI only sees an Object and converts it with JULongBox.
 */
struct JULong : jni::JavaClass<JULong> {
  static constexpr auto kJavaDescriptor = "Ljava/lang/Object;";
};

/** A Kotlin ULongArray in an erased generic, see JULong. */
struct JULongArray : jni::JavaClass<JULongArray> {
  static constexpr auto kJavaDescriptor = "Ljava/lang/Object;";
};

/**
 * Creates and reads JULong and JULongArray boxes without calling into Kotlin. nitro-core's ULongBox
 * gives JNI their classes and value fields once, since JNI cannot name them.
 */
struct JULongBox : jni::JavaClass<JULongBox> {
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/utils/ULongBox;";

  static jni::local_ref<JULong> box(jlong value) {
    const auto& layout = getULongLayout();
    JNIEnv* env = jni::Environment::current();
    jobject box = env->AllocObject(layout.clazz);
    FACEBOOK_JNI_THROW_PENDING_EXCEPTION();
    env->SetLongField(box, layout.field, value);
    return jni::adopt_local(static_cast<JULong::javaobject>(box));
  }
  static jlong unbox(jni::alias_ref<JULong> value) {
    return jni::Environment::current()->GetLongField(value.get(), getULongLayout().field);
  }
  static jni::local_ref<JULongArray> boxArray(jni::alias_ref<JArrayUInt64> values) {
    const auto& layout = getULongArrayLayout();
    JNIEnv* env = jni::Environment::current();
    jobject box = env->AllocObject(layout.clazz);
    FACEBOOK_JNI_THROW_PENDING_EXCEPTION();
    env->SetObjectField(box, layout.field, values.get());
    return jni::adopt_local(static_cast<JULongArray::javaobject>(box));
  }
  static jni::local_ref<JArrayUInt64> unboxArray(jni::alias_ref<JULongArray> value) {
    jobject array = jni::Environment::current()->GetObjectField(value.get(), getULongArrayLayout().field);
    return jni::adopt_local(static_cast<JArrayUInt64::javaobject>(array));
  }

private:
  struct Layout {
    // Never released, like fbjni's own class references.
    jclass clazz;
    jfieldID field;
  };

  static Layout getLayout(const char* classMethod, const char* fieldMethod) {
    const auto helper = javaClassStatic();
    const auto getClass = helper->getStaticMethod<jni::local_ref<jni::JClass>()>(classMethod);
    const auto getField = helper->getStaticMethod<jni::local_ref<jni::JObject>()>(fieldMethod);
    auto field = getField(helper);
    jfieldID fieldID = jni::Environment::current()->FromReflectedField(field.get());
    FACEBOOK_JNI_THROW_PENDING_EXCEPTION();
    auto clazz = jni::make_global(getClass(helper));
    return Layout{clazz.release(), fieldID};
  }
  static const Layout& getULongLayout() {
    static const Layout layout = getLayout("ulongClass", "ulongField");
    return layout;
  }
  static const Layout& getULongArrayLayout() {
    static const Layout layout = getLayout("ulongArrayClass", "ulongArrayField");
    return layout;
  }
};

} // namespace margelo::nitro
