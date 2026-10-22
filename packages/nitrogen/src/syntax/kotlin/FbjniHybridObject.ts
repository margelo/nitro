import { indent } from '../../utils.js'
import { getAllTypes } from '../getAllTypes.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { createFileMetadataString } from '../helpers.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { getKotlinPropertyAccessors, KotlinInstanceMethod } from './KotlinInstanceMethod.js'
import { wrapKotlinType } from './wrapKotlinType.js'
import { getImportsCode } from '../getImportCode.js'
import { createKotlinHybridClassBindings } from './KotlinHybridClassBindings.js'
import type { KotlinHybridObjectType } from './types/KotlinHybridObjectType.js'

interface FbjniHybridObjectOptions {
  spec: HybridObjectSpec<'kotlin'>
  hybridObject: KotlinHybridObjectType
}

export function createFbjniHybridObject({ spec, hybridObject }: FbjniHybridObjectOptions): SourceFile[] {
  const name = getHybridObjectName(spec.name)
  const properties = spec.properties
  const nativeMethods = spec.methods
  const nonvirtual = hybridObject.canUseNonvirtualJniCalls
  const propertyAccessors = properties.flatMap(getKotlinPropertyAccessors)
  const propertyDefinitions = propertyAccessors.flatMap((accessor) => accessor.createBridge({ nonvirtual: nonvirtual }).cppMethods)
  const methodDefinitions = nativeMethods.flatMap(
    (method) => new KotlinInstanceMethod({ method: method }).createBridge({ nonvirtual: nonvirtual }).cppMethods
  )
  const bindings = createKotlinHybridClassBindings(spec)
  let getClassBody: string
  if (nonvirtual) {
    getClassBody = `
static const auto __field = CxxPart::javaClassStatic()->getStaticField<jni::JClass>("implementationClass_cxx");
static const auto __class = jni::make_global(CxxPart::javaClassStatic()->getStaticFieldValue(__field));
return __class;
`.trim()
  } else {
    getClassBody = `
return ${name.JHybridTSpec}::JavaPart::javaClassStatic();
`.trim()
  }
  const registrations: string[] = []
  for (const property of properties) {
    const accessors = [`&${name.JHybridTSpec}::${property.getGetterName('other')}`]
    if (!property.isReadonly) {
      accessors.push(`&${name.JHybridTSpec}::${property.getSetterName('other')}`)
    }
    registrations.push(`clazz.registerHybridProperty("${property.name}", ${accessors.join(', ')});`)
  }
  for (const method of nativeMethods) {
    registrations.push(`clazz.registerHybridMethod("${method.name}", &${name.JHybridTSpec}::${method.name});`)
  }
  registrations.push(...bindings.registrations)

  const propertiesDecl = propertyDefinitions.map(({ method }) => method.getDeclaration('c++')).join('\n')
  const methodsDecl = methodDefinitions.map(({ method }) => method.getDeclaration('c++')).join('\n')
  const jniClassDescriptor = spec.config.getAndroidPackage('c++/jni', name.HybridTSpec)
  const cxxPartJniClassDescriptor = `${jniClassDescriptor}$CxxPart`
  const cxxNamespace = spec.config.getCxxNamespace('c++')

  if (spec.baseTypes.length > 1) {
    throw new Error(`${name.T}: Inheriting from multiple HybridObject bases is not yet supported on Kotlin!`)
  }
  const base = spec.baseTypes[0]
  let cppBaseClass: string
  let javaPartBaseClass: string
  let cxxPartBaseClass: string
  if (base != null) {
    const baseName = getHybridObjectName(base.name).JHybridTSpec
    cppBaseClass = base.config.getCxxNamespace('c++', baseName)
    javaPartBaseClass = base.config.getCxxNamespace('c++', getHybridObjectName(base.name).JHybridTSpecJavaPart)
    cxxPartBaseClass = `${cppBaseClass}::CxxPart`
  } else {
    cppBaseClass = 'JHybridObject'
    javaPartBaseClass = 'JHybridObject::JavaPart'
    cxxPartBaseClass = 'JHybridObject::CxxPart'
  }
  const allTypes = getAllTypes(spec)
  const cppMethods = [...propertyDefinitions, ...methodDefinitions]
  const signatureImports = cppMethods.flatMap(({ method }) => method.getRequiredImports('c++'))
  const nativeImports = [
    ...allTypes.flatMap((type) => wrapKotlinType(type).getRequiredImports('c++')),
    ...signatureImports,
    ...bindings.imports,
  ]
  const cppImports: SourceImport[] = [
    { language: 'c++', declaration: { header: 'NitroModules/JHybridObject.hpp', space: 'system' } },
    { language: 'c++', declaration: { header: 'NitroModules/HybridClass.hpp', space: 'system' } },
    { language: 'c++', declaration: { header: 'fbjni/fbjni.h', space: 'system' } },
    { language: 'c++', declaration: { header: 'stdexcept', space: 'system' } },
    { language: 'c++', declaration: spec.config.getCxxHeader(`${name.JHybridTSpecJavaPart}.hpp`, 'private') },
    ...nativeImports,
  ]
  if (base != null) {
    const baseName = getHybridObjectName(base.name).JHybridTSpec
    cppImports.push({ language: 'c++', declaration: base.config.getCxxHeader(`${baseName}.hpp`, 'private') })
  }
  const cppDeclarationIncludes = getImportsCode(cppImports, 'declaration')
  const classFinality = spec.allowInheritance ? '' : ' final'

  let implementationCheck: string
  if (nonvirtual) {
    implementationCheck = `
#ifdef NITRO_DEBUG
if (!jni::isSameObject(_javaPart->getClass(), CxxPart::getClass())) [[unlikely]] {
  throw std::runtime_error("${spec.name} requires its configured implementation when inheritance and multiple implementations are disabled.");
}
#endif
`.trim()
  } else {
    implementationCheck = ''
  }

  const javaPartImports: SourceImport[] = [
    { language: 'c++', declaration: { header: 'NitroModules/JHybridObject.hpp', space: 'system' } },
    { language: 'c++', declaration: { header: 'fbjni/fbjni.h', space: 'system' } },
    { language: 'c++', declaration: { header: 'memory', space: 'system' } },
  ]
  if (base != null) {
    const baseName = getHybridObjectName(base.name).JHybridTSpecJavaPart
    javaPartImports.push({ language: 'c++', declaration: base.config.getCxxHeader(`${baseName}.hpp`, 'private') })
  }
  const javaPartIncludes = getImportsCode(javaPartImports, 'declaration')
  const javaPartHeaderCode = `
${createFileMetadataString(`${name.JHybridTSpecJavaPart}.hpp`)}

#pragma once

${javaPartIncludes}

namespace ${cxxNamespace} {

  namespace jni = facebook::jni;

  class ${name.JHybridTSpec};

  struct ${name.JHybridTSpecJavaPart} : public jni::JavaClass<${name.JHybridTSpecJavaPart}, ${javaPartBaseClass}> {
    using HybridType = ${name.JHybridTSpec};
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";
    std::shared_ptr<${name.JHybridTSpec}> get${name.JHybridTSpec}();
  };

} // namespace ${cxxNamespace}
`.trim()

  const cppHeaderCode = `
${createFileMetadataString(`${name.JHybridTSpec}.hpp`)}

#pragma once

${cppDeclarationIncludes}

namespace ${cxxNamespace} {

  namespace jni = facebook::jni;

  class ${name.JHybridTSpec}${classFinality} : public ${cppBaseClass} {
  public:
    struct Class {
      using Base = ${cppBaseClass}::Class;
      static constexpr const char* name = "${spec.name}";
      static const std::shared_ptr<const HybridClass>& get();
    };

  public:
    using JavaPart = ${name.JHybridTSpecJavaPart};
    struct CxxPart : public jni::HybridClass<CxxPart, ${cxxPartBaseClass}> {
      static constexpr auto kJavaDescriptor = "L${cxxPartJniClassDescriptor};";
      static jni::local_ref<jhybriddata> initHybrid(jni::alias_ref<jhybridobject> jThis);
      static void registerNatives();
      static jni::alias_ref<jni::JClass> getClass();
      using HybridBase::HybridBase;
    protected:
      std::shared_ptr<JHybridObject> createHybridObject(jni::alias_ref<JHybridObject::JavaPart> javaPart) override;
    };

  public:
    explicit ${name.JHybridTSpec}(jni::alias_ref<${name.JHybridTSpec}::JavaPart> javaPart):
      ${cppBaseClass}(javaPart),
      _javaPart(jni::static_ref_cast<JavaPart>(JHybridObject::getJavaPart())) {
      ${indent(implementationCheck, '      ')}
    }
    // Defined in the owning library so RTTI has one identity across modules.
    ~${name.JHybridTSpec}() override;

  public:
    inline jni::alias_ref<${name.JHybridTSpec}::JavaPart> getJavaPart() const noexcept {
      return _javaPart;
    }

  public:
    // Properties
    ${indent(propertiesDecl, '    ')}

  public:
    // Methods
    ${indent(methodsDecl, '    ')}

  public:
    // Constructor and static members
    ${indent(bindings.declarations.join('\n'), '    ')}

  protected:
    const std::shared_ptr<const HybridClass>& getHybridClass() override {
      return Class::get();
    }

  private:
    jni::alias_ref<${name.JHybridTSpec}::JavaPart> _javaPart;
  };

} // namespace ${cxxNamespace}
  `.trim()

  const propertiesImpl = propertyDefinitions
    .map(({ method, body }) =>
      method.getDefinition('c++', {
        placement: 'out-of-class',
        className: name.JHybridTSpec,
        body: body,
      })
    )
    .join('\n')
  const methodsImpl = methodDefinitions
    .map(({ method, body }) =>
      method.getDefinition('c++', {
        placement: 'out-of-class',
        className: name.JHybridTSpec,
        body: body,
      })
    )
    .join('\n')
  const jniImports = allTypes.map((type) => wrapKotlinType(type)).flatMap((t) => t.getRequiredImports('c++'))
  const cppImplementationIncludes = getImportsCode(
    [
      {
        language: 'c++',
        declaration: spec.config.getCxxHeader(`${name.JHybridTSpec}.hpp`, 'private'),
      },
      ...nativeImports,
      ...jniImports,
      ...bindings.imports,
      ...bindings.implementationImports,
    ],
    'implementation'
  )

  const cppImplCode = `
${createFileMetadataString(`${name.JHybridTSpec}.cpp`)}

${cppImplementationIncludes}

namespace ${cxxNamespace} {

  ${name.JHybridTSpec}::~${name.JHybridTSpec}() = default;

  ${indent(bindings.definitions.join('\n\n'), '  ')}

  const std::shared_ptr<const HybridClass>& ${name.JHybridTSpec}::Class::get() {
    static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
      ${indent(registrations.join('\n'), '      ')}
    });
    return hybridClass;
  }

  std::shared_ptr<${name.JHybridTSpec}> ${name.JHybridTSpecJavaPart}::get${name.JHybridTSpec}() {
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

  jni::alias_ref<jni::JClass> ${name.JHybridTSpec}::CxxPart::getClass() {
    ${indent(getClassBody, '    ')}
  }

  std::shared_ptr<JHybridObject> ${name.JHybridTSpec}::CxxPart::createHybridObject(jni::alias_ref<JHybridObject::JavaPart> javaPart) {
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

  const files: SourceFile[] = [
    {
      content: javaPartHeaderCode,
      language: 'c++',
      name: `${name.JHybridTSpecJavaPart}.hpp`,
      subdirectory: [],
      headerVisibility: 'private',
      platform: 'android',
    },
  ]
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
