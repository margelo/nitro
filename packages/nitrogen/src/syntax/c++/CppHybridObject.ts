import type { SourceFile, SourceImport } from '../SourceFile.js'
import { createFileMetadataString } from '../helpers.js'
import { indent } from '../../utils.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { InstanceMethod } from '../InstanceMethod.js'
import { getImportCode, getImportsCode } from '../getImportCode.js'
import type { Platform } from '../../getPlatformSpecs.js'
import { createCppHybridClassBindings, type HybridClassBindings } from './CppHybridClassBindings.js'
import { createKotlinHybridClassBindings } from '../kotlin/KotlinHybridClassBindings.js'
import { withDocumentation } from '../Documentation.js'

export function createCppHybridObject(spec: HybridObjectSpec, platform: Platform): SourceFile[] {
  if (spec.baseTypes.length > 1) {
    throw new Error(`${spec.name} cannot extend multiple HybridObjects. Use a single base class.`)
  }
  const baseSpec = spec.baseTypes[0]
  let hybridClassBase: string
  if (baseSpec != null) {
    const baseName = getHybridObjectName(baseSpec.name).HybridTSpec
    if (baseSpec.config.isExternalConfig) {
      hybridClassBase = baseSpec.config.getCxxNamespace('c++', baseName)
    } else {
      hybridClassBase = baseName
    }
  } else {
    hybridClassBase = 'HybridObject'
  }
  const members = [...spec.properties, ...spec.methods, ...spec.staticMethods, ...spec.staticProperties]
  const extraFiles = members.flatMap((member) => member.getExtraFiles())
  const memberImports = members.flatMap((member) => member.getRequiredImports('c++'))
  if (spec.constructor != null) {
    extraFiles.push(...spec.constructor.getExtraFiles())
    memberImports.push(...spec.constructor.getRequiredImports('c++'))
  }
  const declarationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: {
        header: 'NitroModules/HybridObject.hpp',
        space: 'system',
      },
    },
    {
      language: 'c++',
      declaration: {
        header: 'NitroModules/HybridClass.hpp',
        space: 'system',
      },
    },
    ...memberImports,
    ...spec.baseTypes.map(
      (base): SourceImport => ({
        language: 'c++',
        declaration: base.config.getCxxHeader(`${getHybridObjectName(base.name).HybridTSpec}.hpp`),
      })
    ),
  ]
  const cppDeclarationIncludes = getImportsCode(declarationImports, 'declaration')
  const cxxNamespace = spec.config.getCxxNamespace('c++')
  const name = getHybridObjectName(spec.name)
  let bindings: HybridClassBindings | undefined
  switch (spec.language) {
    case 'c++':
      bindings = createCppHybridClassBindings(spec)
      break
    case 'kotlin':
      bindings = createKotlinHybridClassBindings(spec)
      break
    case 'swift':
      // The Swift bridge registers its constructor and static methods itself.
      bindings = undefined
      break
  }
  const hybridClassDefinitions = bindings?.definitions ?? []
  const classRegistrations = bindings?.registrations ?? []
  const classImports = bindings?.imports ?? []
  const cppClassIncludes = getImportsCode(classImports, 'implementation')
  const specImport: SourceImport = {
    language: 'c++',
    declaration: spec.config.getCxxHeader(`${getHybridObjectName(spec.name).HybridTSpec}.hpp`),
  }
  const cppSpecInclude = getImportCode(specImport)
  const cppImplementationIncludes = getImportsCode([specImport, ...memberImports], 'implementation')

  const properties = spec.properties.map((property) =>
    withDocumentation({
      code: property.getCode('c++', { virtual: true }),
      documentation: property.documentation,
      language: 'c++',
    })
  )
  const abstractMethods = spec.methods.map(
    (method) =>
      new InstanceMethod(method.name, method.returnType, method.parameters, {
        pureVirtual: true,
        documentation: method.documentation,
      })
  )
  const methods = abstractMethods.map((method) =>
    withDocumentation({
      code: method.getDeclaration('c++'),
      documentation: method.documentation,
      language: 'c++',
    })
  )

  const bases = ['public virtual HybridObject']
  for (const base of spec.baseTypes) {
    const baseName = getHybridObjectName(base.name).HybridTSpec
    const fullName = base.config.isExternalConfig ? base.config.getCxxNamespace('c++', baseName) : baseName
    bases.push(`public virtual ${fullName}`)
  }

  const classDeclaration = withDocumentation({
    code: `
class ${name.HybridTSpec} : ${bases.join(', ')}
`.trim(),
    documentation: spec.documentation,
    language: 'c++',
    emitDeprecation: false,
  })
  // Generate the full header / code
  const cppHeaderCode = `
${createFileMetadataString(`${name.HybridTSpec}.hpp`)}

#pragma once

${cppDeclarationIncludes}

namespace ${cxxNamespace} {

  using namespace margelo::nitro;

  /**
   * An abstract base class for \`${spec.name}\`
   * Inherit this class to create instances of \`${name.HybridTSpec}\` in C++.
   * @example
   * \`\`\`cpp
   * class ${name.HybridT} : public ${name.HybridTSpec} {
   * public:
   *   ${name.HybridT}(...) { ... }
   *   // ...
   * };
   * \`\`\`
   */
  ${indent(classDeclaration, '  ')} {
    public:
      struct Class {
        using Base = ${hybridClassBase}::Class;
        static constexpr const char* name = "${spec.name}";
        static const std::shared_ptr<const HybridClass>& get();
      };

    public:
      // Constructor
      ${name.HybridTSpec}() = default;

      // Destructor
      ~${name.HybridTSpec}() override;

    public:
      // Properties
      ${indent(properties.join('\n'), '      ')}

    public:
      // Methods
      ${indent(methods.join('\n'), '      ')}

    protected:
      // Hybrid Setup
      const std::shared_ptr<const HybridClass>& getHybridClass() override {
        return Class::get();
      }
  };

} // namespace ${cxxNamespace}
`.trim()

  // Register properties together with their optional setters, then normal methods.
  const registrations: string[] = []
  for (const property of spec.properties) {
    const accessors = [`&${name.HybridTSpec}::${property.getGetterName('other')}`]
    if (!property.isReadonly) {
      accessors.push(`&${name.HybridTSpec}::${property.getSetterName('other')}`)
    }
    registrations.push(`clazz.registerHybridProperty("${property.name}", ${accessors.join(', ')});`)
  }
  for (const method of spec.methods) {
    // method
    const methodRegistration = `
clazz.registerHybridMethod("${method.name}", &${name.HybridTSpec}::${method.name});
`.trim()
    registrations.push(methodRegistration)
  }

  registrations.push(...classRegistrations)
  const cppBodyCode = `
${createFileMetadataString(`${name.HybridTSpec}.cpp`)}

${cppSpecInclude}

namespace ${cxxNamespace} {

  ${name.HybridTSpec}::~${name.HybridTSpec}() = default;

} // namespace ${cxxNamespace}
`.trim()
  const hybridClassFileName = `${name.HybridTSpec}Class.cpp`
  const cppHybridClassCode = `
${createFileMetadataString(hybridClassFileName)}

${cppImplementationIncludes}
${cppClassIncludes}

namespace ${cxxNamespace} {

  ${indent(hybridClassDefinitions.join('\n\n'), '  ')}

  const std::shared_ptr<const HybridClass>& ${name.HybridTSpec}::Class::get() {
    static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
      ${indent(registrations.join('\n'), '      ')}
    });
    return hybridClass;
  }

} // namespace ${cxxNamespace}
`.trim()

  const isSharedCppSpec = Object.values(spec.platforms).every((options) => options.language === 'c++')
  const nativePlatform = isSharedCppSpec ? 'shared' : platform

  const files: SourceFile[] = []
  files.push({
    content: cppHeaderCode,
    name: `${name.HybridTSpec}.hpp`,
    subdirectory: [],
    language: 'c++',
    platform: nativePlatform,
    headerVisibility: 'public',
  })
  files.push({
    content: cppBodyCode,
    name: `${name.HybridTSpec}.cpp`,
    subdirectory: [],
    language: 'c++',
    platform: nativePlatform,
  })
  files.push({
    content: cppHybridClassCode,
    name: hybridClassFileName,
    subdirectory: [],
    language: 'c++',
    platform: platform,
  })
  files.push(...extraFiles)
  return files
}
