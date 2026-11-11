import { indent } from '../../utils.js'
import { getForwardDeclaration } from '../c++/getForwardDeclaration.js'
import { includeHeader } from '../c++/includeNitroHeader.js'
import { getAllTypes } from '../getAllTypes.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { Method } from '../Method.js'
import type { Property } from '../Property.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { Type } from '../types/Type.js'
import { addJNINativeRegistration } from './JNINativeRegistrations.js'
import { KotlinCxxBridgedType } from './KotlinCxxBridgedType.js'

export function createFbjniHybridObject(spec: HybridObjectSpec): SourceFile[] {
  const name = getHybridObjectName(spec.name)

  // Because we cache JNI methods as `static` inside our method bodies,
  // we need to re-create the method bodies per inherited class.
  // This way `Child`'s statically cached `someMethod()` JNI reference
  // is not the same as `Base`'s statically cached `someMethod()` JNI reference.
  const properties = [
    ...spec.properties,
    ...spec.baseTypes.flatMap((b) => b.properties),
  ]
  const methods = [...spec.methods, ...spec.baseTypes.flatMap((b) => b.methods)]

  const propertiesDecl = properties
    .map((p) => p.getCode('c++', { override: true }))
    .join('\n')
  const methodsDecl = methods
    .map((p) => p.getCode('c++', { override: true }))
    .join('\n')
  const jniClassDescriptor = spec.config.getAndroidPackage(
    'c++/jni',
    name.HybridTSpec
  )
  const cxxPartJniClassDescriptor = `${jniClassDescriptor}$CxxPart`
  const cxxNamespace = spec.config.getCxxNamespace('c++')

  let cppBaseClass = 'JHybridObject'
  let javaPartBaseClass = 'JHybridObject::JavaPart'
  let cxxPartBaseClass = 'JHybridObject::CxxPart'
  const constructorCalls = [
    `HybridObject(${name.HybridTSpec}::TAG)`,
    `JHybridObject(javaPart)`,
  ]
  if (spec.baseTypes.length > 0) {
    if (spec.baseTypes.length > 1) {
      throw new Error(
        `${name.T}: Inheriting from multiple HybridObject bases is not yet supported on Kotlin!`
      )
    }
    const base = spec.baseTypes[0]!
    let baseTypename = getHybridObjectName(base.name).JHybridTSpec
    if (base.config.isExternalConfig) {
      // It's an external type we inherit from - we have to prefix the namespace
      baseTypename = base.config.getCxxNamespace('c++', baseTypename)
    }
    cppBaseClass = baseTypename
    javaPartBaseClass = `${baseTypename}::JavaPart`
    cxxPartBaseClass = `${baseTypename}::CxxPart`
    constructorCalls.push(`${baseTypename}(javaPart)`)
  }
  const cppImports: SourceImport[] = []
  for (const base of spec.baseTypes) {
    const { JHybridTSpec } = getHybridObjectName(base.name)

    const headerName = base.config.isExternalConfig
      ? `${base.config.getAndroidCxxLibName()}/${JHybridTSpec}.hpp`
      : `${JHybridTSpec}.hpp`
    cppImports.push({
      language: 'c++',
      name: headerName,
      space: base.config.isExternalConfig ? 'system' : 'user',
      forwardDeclaration: getForwardDeclaration(
        'class',
        JHybridTSpec,
        base.config.getCxxNamespace('c++')
      ),
    })
  }

  const cppHeaderCode = `
${createFileMetadataString(`${name.HybridTSpec}.hpp`)}

#pragma once

#include <NitroModules/JHybridObject.hpp>
#include <fbjni/fbjni.h>
#include "${name.HybridTSpec}.hpp"

${cppImports
  .map((i) => i.forwardDeclaration)
  .filter((f) => f != null)
  .join('\n')}
${cppImports.map((i) => includeHeader(i)).join('\n')}

namespace ${cxxNamespace} {

  using namespace facebook;

  class ${name.JHybridTSpec}: public virtual ${name.HybridTSpec}, public virtual ${cppBaseClass} {
  public:
    struct JavaPart: public jni::JavaClass<JavaPart, ${javaPartBaseClass}> {
      static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";
      std::shared_ptr<${name.JHybridTSpec}> get${name.JHybridTSpec}();
    };
    struct CxxPart: public jni::HybridClass<CxxPart, ${cxxPartBaseClass}> {
      static constexpr auto kJavaDescriptor = "L${cxxPartJniClassDescriptor};";
      static jni::local_ref<jhybriddata> initHybrid(jni::alias_ref<jhybridobject> jThis);
      static void registerNatives();
      using HybridBase::HybridBase;
    protected:
      std::shared_ptr<JHybridObject> createHybridObject(const jni::local_ref<JHybridObject::JavaPart>& javaPart) override;
    };

  public:
    explicit ${name.JHybridTSpec}(const jni::local_ref<${name.JHybridTSpec}::JavaPart>& javaPart):
      ${indent(constructorCalls.join(',\n'), '      ')},
      _javaPart(jni::make_global(javaPart)) {}
    ~${name.JHybridTSpec}() override {
      // Hermes GC can destroy JS objects on a non-JNI Thread.
      jni::ThreadScope::WithClassLoader([&] { _javaPart.reset(); });
    }

  public:
    inline const jni::global_ref<${name.JHybridTSpec}::JavaPart>& getJavaPart() const noexcept {
      return _javaPart;
    }

  public:
    // Properties
    ${indent(propertiesDecl, '    ')}

  public:
    // Methods
    ${indent(methodsDecl, '    ')}

  private:
    jni::global_ref<${name.JHybridTSpec}::JavaPart> _javaPart;
  };

} // namespace ${cxxNamespace}
  `.trim()

  // Make sure we register all native JNI methods on app startup
  addJNINativeRegistration({
    namespace: cxxNamespace,
    className: `${name.JHybridTSpec}::CxxPart`,
    import: {
      name: `${name.JHybridTSpec}.hpp`,
      space: 'user',
      language: 'c++',
    },
  })

  const propertiesImpl = properties
    .map((m) => getFbjniPropertyForwardImplementation(spec, m))
    .join('\n')
  const methodsImpl = methods
    .map((m) => getFbjniMethodForwardImplementation(spec, m, m.name))
    .join('\n')
  const allTypes = getAllTypes(spec)
  allTypes.push(...getAllBaseTypes(spec)) // <-- remember, we copy all base methods & properties over too
  const jniImports = allTypes
    .map((t) => new KotlinCxxBridgedType(t))
    .flatMap((t) => t.getRequiredImports('c++'))
    .filter((i) => i != null)
  const cppIncludes = jniImports
    .map((i) => includeHeader(i))
    .filter(isNotDuplicate)
  const cppForwardDeclarations = jniImports
    .map((i) => i.forwardDeclaration)
    .filter((d) => d != null)
    .filter(isNotDuplicate)

  const cppImplCode = `
${createFileMetadataString(`${name.JHybridTSpec}.cpp`)}

#include "${name.JHybridTSpec}.hpp"

${cppForwardDeclarations.join('\n')}

${cppIncludes.join('\n')}

namespace ${cxxNamespace} {

  std::shared_ptr<${name.JHybridTSpec}> ${name.JHybridTSpec}::JavaPart::get${name.JHybridTSpec}() {
    auto hybridObject = JHybridObject::JavaPart::getJHybridObject();
    auto castHybridObject = std::dynamic_pointer_cast<${name.JHybridTSpec}>(hybridObject);
    if (castHybridObject == nullptr) [[unlikely]] {
      throw std::runtime_error("Failed to downcast JHybridObject to ${name.JHybridTSpec}!");
    }
    return castHybridObject;
  }

  jni::local_ref<${name.JHybridTSpec}::CxxPart::jhybriddata> ${name.JHybridTSpec}::CxxPart::initHybrid(jni::alias_ref<jhybridobject> jThis) {
    return makeCxxInstance(jThis);
  }

  std::shared_ptr<JHybridObject> ${name.JHybridTSpec}::CxxPart::createHybridObject(const jni::local_ref<JHybridObject::JavaPart>& javaPart) {
    auto castJavaPart = jni::dynamic_ref_cast<${name.JHybridTSpec}::JavaPart>(javaPart);
    if (castJavaPart == nullptr) [[unlikely]] {
      throw std::runtime_error("Failed to cast JHybridObject::JavaPart to ${name.JHybridTSpec}::JavaPart!");
    }
    return std::make_shared<${name.JHybridTSpec}>(castJavaPart);
  }

  void ${name.JHybridTSpec}::CxxPart::registerNatives() {
    registerHybrid({
      makeNativeMethod("initHybrid", ${name.JHybridTSpec}::CxxPart::initHybrid),
    });
  }

  // Properties
  ${indent(propertiesImpl, '  ')}

  // Methods
  ${indent(methodsImpl, '  ')}

} // namespace ${cxxNamespace}
  `.trim()

  const files: SourceFile[] = []
  files.push({
    content: cppHeaderCode,
    language: 'c++',
    name: `${name.JHybridTSpec}.hpp`,
    subdirectory: [],
    platform: 'android',
  })
  files.push({
    content: cppImplCode,
    language: 'c++',
    name: `${name.JHybridTSpec}.cpp`,
    subdirectory: [],
    platform: 'android',
  })
  return files
}

function getFbjniMethodForwardImplementation(
  spec: HybridObjectSpec,
  method: Method,
  jniMethodName: string
): string {
  const name = getHybridObjectName(spec.name)

  const returnJNI = new KotlinCxxBridgedType(method.returnType)
  const requiresBridge =
    returnJNI.needsSpecialHandling ||
    method.parameters.some((p) => {
      const bridged = new KotlinCxxBridgedType(p.type)
      return bridged.needsSpecialHandling
    })
  const methodName = requiresBridge ? `${jniMethodName}_cxx` : jniMethodName

  const returnType = returnJNI.asJniReferenceType('local')
  const paramsTypes = method.parameters
    .map((p) => {
      const bridge = new KotlinCxxBridgedType(p.type)
      return `${bridge.asJniReferenceType('alias')} /* ${p.name} */`
    })
    .join(', ')
  const cxxSignature = `${returnType}(${paramsTypes})`

  const paramsForward = method.parameters.map((p) => {
    const bridged = new KotlinCxxBridgedType(p.type)
    return bridged.parse(p.name, 'c++', 'kotlin', 'c++')
  })
  paramsForward.unshift('_javaPart') // <-- first param is always Java `this`

  let body: string
  if (returnJNI.hasType) {
    // return something - we need to parse it
    body = `
static const auto method = _javaPart->javaClassStatic()->getMethod<${cxxSignature}>("${methodName}");
auto __result = method(${paramsForward.join(', ')});
return ${returnJNI.parse('__result', 'kotlin', 'c++', 'c++')};
    `
  } else {
    // void method. no return
    body = `
static const auto method = _javaPart->javaClassStatic()->getMethod<${cxxSignature}>("${methodName}");
method(${paramsForward.join(', ')});
   `
  }
  const code = method.getCode(
    'c++',
    {
      classDefinitionName: name.JHybridTSpec,
    },
    body.trim()
  )
  return code
}

function getFbjniPropertyForwardImplementation(
  spec: HybridObjectSpec,
  property: Property
): string {
  const methods: string[] = []

  // getter
  const getter = getFbjniMethodForwardImplementation(
    spec,
    property.cppGetter,
    property.getGetterName('jvm')
  )
  methods.push(getter)

  if (property.cppSetter != null) {
    // setter
    const setter = getFbjniMethodForwardImplementation(
      spec,
      property.cppSetter,
      property.getSetterName('jvm')
    )
    methods.push(setter)
  }

  return methods.join('\n')
}

function getAllBaseTypes(spec: HybridObjectSpec): Type[] {
  return spec.baseTypes.flatMap((b) => getAllTypes(b))
}
