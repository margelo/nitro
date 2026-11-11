import { NitroConfig } from '../../config/NitroConfig.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import type { SourceImport } from '../SourceFile.js'

interface Props {
  /**
   * The name of the Hybrid Object under which it should be registered and exposed to JS to.
   */
  hybridObjectName: string
  /**
   * The name of the Kotlin/Java class that will be default-constructed
   */
  jniClassName: string
}

interface JNIHybridObjectRegistration {
  cppCode: string
  cppDefinition: string
  requiredImports: SourceImport[]
}

export function createJNIHybridObjectRegistration({
  hybridObjectName,
  jniClassName,
}: Props): JNIHybridObjectRegistration {
  const { JHybridTSpec } = getHybridObjectName(hybridObjectName)
  const jniNamespace = NitroConfig.current.getAndroidPackage(
    'c++/jni',
    jniClassName
  )

  return {
    requiredImports: [
      { name: `${JHybridTSpec}.hpp`, language: 'c++', space: 'user' },
      {
        name: 'NitroModules/DefaultConstructableObject.hpp',
        language: 'c++',
        space: 'system',
      },
    ],
    cppDefinition: `
struct ${JHybridTSpec}Impl: public jni::JavaClass<${JHybridTSpec}Impl, ${JHybridTSpec}::JavaPart> {
  static constexpr auto kJavaDescriptor = "L${jniNamespace};";
  static std::shared_ptr<${JHybridTSpec}> create() {
    static const auto constructorFn = javaClassStatic()->getConstructor<${JHybridTSpec}Impl::javaobject()>();
    jni::local_ref<${JHybridTSpec}::JavaPart> javaPart = javaClassStatic()->newObject(constructorFn);
    return javaPart->get${JHybridTSpec}();
  }
};
    `.trim(),
    cppCode: `
HybridObjectRegistry::registerHybridObjectConstructor(
  "${hybridObjectName}",
  []() -> std::shared_ptr<HybridObject> {
    return ${JHybridTSpec}Impl::create();
  }
);
      `.trim(),
  }
}
