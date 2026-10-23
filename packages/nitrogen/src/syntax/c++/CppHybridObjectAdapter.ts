import { wrapKotlinType } from '../kotlin/wrapKotlinType.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import type { Platform } from '../../getPlatformSpecs.js'
import { indent } from '../../utils.js'
import { getUmbrellaHeaderName } from '../../autolinking/apple/createSwiftUmbrellaHeader.js'
import { getImportsCode } from '../getImportCode.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { getAllTypes } from '../getAllTypes.js'
import { createFileMetadataString } from '../helpers.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { Method } from '../Method.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { getSwiftConverter } from '../swift/SwiftConverter.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { getCppHybridObjectAdapterNames } from './CppHybridObjectAdapterNames.js'
import { ForeignHybridObjectType } from './ForeignHybridObjectType.js'
import { wrapSwiftType } from '../swift/wrapSwiftType.js'
import { createKotlinConverters, getKotlinConverter } from '../kotlin/KotlinConverter.js'

/**
 * Expose a callable C++ value handle for a foreign HybridObject.
 * The handle owns the existing object. Its JS identity and prototype remain
 * those of its native bridge, even after a derived handle is copied as its base.
 */
export function createCppHybridObjectAdapter(spec: HybridObjectSpec, platform: Platform = 'apple'): SourceFile[] {
  const hierarchy = [spec, ...getAncestors(spec)]
  const reserved = ['fromNative', 'getNativeObject']
  if (hierarchy.some((current) => current.constructor != null)) reserved.push('create')
  for (const current of hierarchy) {
    const members = [
      ...current.methods,
      ...current.staticMethods,
      ...current.properties.flatMap((property) => property.getCppMethods()),
      ...current.staticProperties.flatMap((property) => property.getStaticMethods()),
    ]
    const conflict = members.find((method) => reserved.includes(method.name))
    if (conflict != null) {
      throw new Error(`${spec.name}: ${current.name}.${conflict.name} conflicts with a C++ adapter helper.`)
    }
  }
  if (spec.baseTypes.length > 1) {
    throw new Error(`${spec.name}: C++ adapters support one HybridObject base.`)
  }
  const type = new ForeignHybridObjectType(new HybridObjectType(spec), platform)
  const names = getCppHybridObjectAdapterNames(type)
  const baseType = type.baseTypes[0]
  let baseNames: ReturnType<typeof getCppHybridObjectAdapterNames> | undefined
  if (baseType != null) {
    baseNames = getCppHybridObjectAdapterNames(baseType)
  } else {
    baseNames = undefined
  }
  const bridgeNames = getHybridObjectName(spec.name)
  let bridgeName: string
  switch (spec.language) {
    case 'swift':
      bridgeName = bridgeNames.HybridTSpecSwift
      break
    case 'kotlin':
      bridgeName = bridgeNames.JHybridTSpec
      break
    case 'c++':
      bridgeName = bridgeNames.HybridTSpec
      break
  }
  const bridge = spec.config.getCxxNamespace('c++', bridgeName)
  let staticTarget: string
  if (spec.language === 'c++' && spec.implementation != null) {
    staticTarget = ['', ...spec.implementation.namespace, spec.implementation.className].join('::')
  } else {
    staticTarget = bridge
  }
  const instanceMethods = [...spec.properties.flatMap((property) => property.getCppMethods()), ...spec.methods]
  const staticMethods = [...spec.staticProperties.flatMap((property) => property.getStaticMethods()), ...spec.staticMethods]
  const allMethods = [...instanceMethods, ...staticMethods]
  const memberImports = allMethods.flatMap((method) => method.getRequiredImports('c++'))
  if (spec.constructor != null) {
    memberImports.push(...spec.constructor.getRequiredImports('c++'))
  }
  const declarationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: { header: 'memory', space: 'system' },
    },
    {
      language: 'c++',
      declaration: { header: 'utility', space: 'system' },
    },
    {
      language: 'c++',
      declaration: { header: 'NitroModules/HybridObject.hpp', space: 'system' },
    },
    {
      language: 'c++',
      declaration: { header: 'NitroModules/JSIConverter.hpp', space: 'system' },
    },
    ...memberImports,
  ]
  if (baseNames != null) {
    declarationImports.push({
      language: 'c++',
      declaration: baseNames.header,
    })
  }
  const implementationImports: SourceImport[] = [
    {
      language: 'c++',
      declaration: names.header,
    },
    {
      language: 'c++',
      declaration: spec.config.getCxxHeader(`${bridgeName}.hpp`, spec.language === 'c++' ? 'public' : 'private'),
    },
    {
      language: 'c++',
      declaration: { header: 'stdexcept', space: 'system' },
    },
    ...memberImports,
  ]
  const conversionFiles: SourceFile[] = []
  switch (spec.language) {
    case 'swift': {
      for (const nativeType of [type, ...getAllTypes(spec)]) {
        const swiftType = wrapSwiftType(nativeType, spec.config)
        const converter = swiftType.getCppConverter?.(nativeType)
        if (converter != null) {
          conversionFiles.push(...converter.files)
          implementationImports.push(...converter.imports)
        }
      }
      implementationImports.push(
        {
          language: 'c++',
          declaration: NitroConfig.current.getCxxHeader(getUmbrellaHeaderName(), 'private'),
        },
        {
          language: 'c++',
          declaration: {
            header: 'NitroModules/SwiftConverter.hpp',
            space: 'system',
          },
        }
      )
      break
    }
    case 'kotlin': {
      for (const cppType of [type, ...getAllTypes(spec)]) {
        const converter = createKotlinConverters(cppType, spec.config)
        conversionFiles.push(...converter.files)
        implementationImports.push(...converter.imports)
      }
      break
    }
    case 'c++':
      if (spec.implementation != null) implementationImports.push(spec.implementation.include)
      break
  }

  function getParameters(method: Method): string {
    return method.parameters.map((parameter) => parameter.getCode('c++')).join(', ')
  }
  function getSignature(method: Method, qualified: boolean, isStatic: boolean): string {
    const returnType = method.returnType.getCode('c++', {
      context: 'return',
      fullyQualified: true,
    })
    const name = qualified ? `${names.className}::${method.name}` : method.name
    const prefix = isStatic && !qualified ? 'static ' : ''
    const suffix = isStatic ? '' : ' const'
    const parameters = getParameters(method)
    return `${prefix}${returnType} ${name}(${parameters})${suffix}`
  }
  function getArguments(method: Method): string[] {
    return method.parameters.map((parameter) => {
      switch (spec.language) {
        case 'swift': {
          const swiftType = wrapSwiftType(parameter.type, spec.config)
          const converter = getSwiftConverter({ cppType: parameter.type, context: 'parameter-type', swiftType: swiftType })
          return `${converter}::toSwift(${parameter.type.escapedName})`
        }
        case 'kotlin': {
          const converter = getKotlinConverter({
            cppType: parameter.type,
            context: 'parameter-type',
            kotlinType: wrapKotlinType(parameter.type, { config: spec.config }),
          })
          return `${converter}::toJNI(${parameter.type.escapedName})`
        }
        case 'c++':
          return `std::forward<decltype(${parameter.type.escapedName})>(${parameter.type.escapedName})`
      }
    })
  }
  function getForwarder(method: Method, invocation: string): string {
    const argumentsList = getArguments(method)
    const call = `${invocation}(${argumentsList.join(', ')})`
    if (method.returnType.kind === 'void') {
      return `
${call};
`.trim()
    }
    switch (spec.language) {
      case 'c++':
        return `
return ${call};
`.trim()
      case 'swift': {
        const swiftType = wrapSwiftType(method.returnType, spec.config)
        const converter = getSwiftConverter({ cppType: method.returnType, swiftType: swiftType })
        return `
auto __result = ${call};
return ${converter}::fromSwift(__result);
`.trim()
      }
      case 'kotlin': {
        const converter = getKotlinConverter({
          cppType: method.returnType,
          kotlinType: wrapKotlinType(method.returnType, { config: spec.config }),
        })
        return `
auto __result = ${call};
return ${converter}::fromJNI(__result);
`.trim()
      }
    }
  }

  const declarations = [
    ...instanceMethods.map((method) => `${getSignature(method, false, false)};`),
    ...staticMethods.map((method) => `${getSignature(method, false, true)};`),
  ]
  const definitions = [
    ...instanceMethods.map((method) => {
      const signature = getSignature(method, true, false)
      const body = getForwarder(method, `__implementation->${method.name}`)
      return `
${signature} {
  auto __implementation = std::dynamic_pointer_cast<${bridge}>(getNativeObject());
  if (__implementation == nullptr) [[unlikely]] {
    throw std::invalid_argument("Cannot call ${spec.name}.${method.name} on an empty or incompatible C++ adapter.");
  }
  ${indent(body, '  ')}
}
`.trim()
    }),
    ...staticMethods.map((method) => {
      const signature = getSignature(method, true, true)
      const body = getForwarder(method, `${staticTarget}::${method.name}`)
      return `
${signature} {
  ${indent(body, '  ')}
}
`.trim()
    }),
  ]
  if (spec.constructor != null) {
    const parameters = getParameters(spec.constructor)
    declarations.unshift(`static ${names.className} create(${parameters});`)
    const argumentsList = getArguments(spec.constructor).join(', ')
    let body: string
    switch (spec.language) {
      case 'swift': {
        const converter = getSwiftConverter({ cppType: type, swiftType: wrapSwiftType(type, spec.config) })
        body = `
auto __result = ${bridge}::constructor(${argumentsList});
return ${converter}::fromSwift(__result);
`.trim()
        break
      }
      case 'kotlin':
        body = `
return fromNative(${bridge}::constructor(${argumentsList}));
`.trim()
        break
      case 'c++':
        body = `
return fromNative(std::make_shared<${staticTarget}>(${argumentsList}));
`.trim()
        break
    }
    definitions.unshift(
      `
${names.className} ${names.className}::create(${parameters}) {
  ${indent(body, '  ')}
}
`.trim()
    )
  }

  const inheritance = baseNames == null ? '' : ` : public ${baseNames.qualifiedName}`
  const initializer =
    baseNames == null ? '_implementation(std::move(implementation))' : `${baseNames.qualifiedName}(std::move(implementation))`
  let nativeAccessor: string
  let nativeStorage: string
  if (baseNames == null) {
    nativeAccessor = `
const std::shared_ptr<HybridObject>& getNativeObject() const noexcept {
  return _implementation;
}
`.trim()
    nativeStorage = `
private:
  std::shared_ptr<HybridObject> _implementation;
`.trim()
  } else {
    nativeAccessor = ''
    nativeStorage = ''
  }
  const declarationIncludes = getImportsCode(declarationImports, 'forward-declaration')
  const implementationIncludes = getImportsCode(implementationImports, 'implementation')
  const headerCode = `
${createFileMetadataString(`${names.fileName}.hpp`)}

#pragma once

${declarationIncludes}

namespace ${names.namespace} {

  class ${names.className}${inheritance} {
  public:
    static ${names.className} fromNative(const std::shared_ptr<HybridObject>& implementation);

    ${indent(nativeAccessor, '    ')}

    ${indent(declarations.join('\n'), '    ')}

    friend bool operator==(const ${names.className}& lhs, const ${names.className}& rhs) noexcept {
      return lhs.getNativeObject() == rhs.getNativeObject();
    }

  protected:
    explicit ${names.className}(std::shared_ptr<HybridObject> implementation):
      ${initializer} {}

  ${indent(nativeStorage, '  ')}
  };

} // namespace ${names.namespace}

namespace margelo::nitro {

  template <>
  struct JSIConverter<${names.qualifiedName}> {
    static ${names.qualifiedName} fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
    static jsi::Value toJSI(jsi::Runtime& runtime, const ${names.qualifiedName}& value);
    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
  };

} // namespace margelo::nitro
`.trim()
  const implementationCode = `
${createFileMetadataString(`${names.fileName}.${platform}.cpp`)}

${implementationIncludes}

namespace ${names.namespace} {

  ${names.className} ${names.className}::fromNative(const std::shared_ptr<HybridObject>& implementation) {
    if (std::dynamic_pointer_cast<${bridge}>(implementation) == nullptr) [[unlikely]] {
      throw std::invalid_argument("Cannot use a HybridObject that does not implement ${spec.name} as ${names.className}.");
    }
    return ${names.className}(implementation);
  }

  ${indent(definitions.join('\n\n'), '  ')}

} // namespace ${names.namespace}

namespace margelo::nitro {

  ${names.qualifiedName} JSIConverter<${names.qualifiedName}>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    return ${names.qualifiedName}::fromNative(JSIConverter<std::shared_ptr<${bridge}>>::fromJSI(runtime, value));
  }

  jsi::Value JSIConverter<${names.qualifiedName}>::toJSI(jsi::Runtime& runtime, const ${names.qualifiedName}& value) {
    return JSIConverter<std::shared_ptr<${bridge}>>::toJSI(runtime, std::dynamic_pointer_cast<${bridge}>(value.getNativeObject()));
  }

  bool JSIConverter<${names.qualifiedName}>::canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    return JSIConverter<std::shared_ptr<${bridge}>>::canConvert(runtime, value);
  }

} // namespace margelo::nitro
`.trim()
  return [
    {
      name: `${names.fileName}.hpp`,
      content: headerCode,
      language: 'c++',
      platform: 'shared',
      subdirectory: [],
      headerVisibility: 'public',
    },
    {
      name: `${names.fileName}.${platform}.cpp`,
      content: implementationCode,
      language: 'c++',
      platform: platform,
      subdirectory: [],
    },
    ...conversionFiles,
    ...allMethods.flatMap((method) => method.getExtraFiles()),
    ...(spec.constructor?.getExtraFiles() ?? []),
  ]
}

function getAncestors(spec: HybridObjectSpec): HybridObjectSpec[] {
  return spec.baseTypes.flatMap((base) => [base, ...getAncestors(base)])
}
