import { escapeCppName, toReferenceType } from '../helpers.js'
import type { SourceImport } from '../SourceFile.js'
import { VariantType } from '../types/VariantType.js'
import { ArrayType } from '../types/ArrayType.js'
import { FunctionType } from '../types/FunctionType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { OptionalType } from '../types/OptionalType.js'
import { RecordType } from '../types/RecordType.js'
import type { NamedType, Type } from '../types/Type.js'
import { TupleType } from '../types/TupleType.js'
import { escapeComments, indent } from '../../utils.js'
import { PromiseType } from '../types/PromiseType.js'
import { SwiftCxxBridgedType } from './SwiftCxxBridgedType.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import { getUmbrellaHeaderName } from '../../autolinking/ios/createSwiftUmbrellaHeader.js'
import { VoidType } from '../types/VoidType.js'
import { NamedWrappingType } from '../types/NamedWrappingType.js'
import { ErrorType } from '../types/ErrorType.js'
import { ResultWrappingType } from '../types/ResultWrappingType.js'

export interface SwiftCxxHelper {
  cxxHeader: {
    code: string
    requiredIncludes: SourceImport[]
  }
  cxxImplementation?: {
    code: string
    requiredIncludes: SourceImport[]
  }
  funcName: string
  specializationName: string
  cxxType: string
  dependencies: SwiftCxxHelper[]
}

export function createSwiftCxxHelpers(type: Type): SwiftCxxHelper | undefined {
  switch (type.kind) {
    case 'hybrid-object':
      return createCxxHybridObjectSwiftHelper(getTypeAs(type, HybridObjectType))
    case 'optional':
      return createCxxOptionalSwiftHelper(getTypeAs(type, OptionalType))
    case 'array':
      return createCxxVectorSwiftHelper(getTypeAs(type, ArrayType))
    case 'record':
      return createCxxUnorderedMapSwiftHelper(getTypeAs(type, RecordType))
    case 'function':
      return createCxxFunctionSwiftHelper(getTypeAs(type, FunctionType))
    case 'variant':
      return createCxxVariantSwiftHelper(getTypeAs(type, VariantType))
    case 'tuple':
      return createCxxTupleSwiftHelper(getTypeAs(type, TupleType))
    case 'promise':
      return createCxxPromiseSwiftHelper(getTypeAs(type, PromiseType))
    case 'result-wrapper':
      return createCxxResultWrapperSwiftHelper(
        getTypeAs(type, ResultWrappingType)
      )
    default:
      return undefined
  }
}

/**
 * Creates a C++ `create_HybridTSpecSwift(value)` function that can be called from Swift.
 */
function createCxxHybridObjectSwiftHelper(
  type: HybridObjectType
): SwiftCxxHelper {
  const actualType = type.getCode('c++')
  const modulename = type.sourceConfig.getIosModuleName()
  const { HybridTSpecCxx, HybridTSpecSwift, HybridTSpec } = getHybridObjectName(
    type.hybridObjectName
  )
  const swiftWrappingType = type.sourceConfig.getCxxNamespace(
    'c++',
    HybridTSpecSwift
  )
  const swiftPartType = `${modulename}::${HybridTSpecCxx}`
  const name = escapeCppName(actualType)

  const upcastHelpers = type.baseTypes.map((base) =>
    createCxxUpcastHelper(base, type)
  )

  const includes: SourceImport[] = []
  if (!type.sourceConfig.isExternalConfig) {
    // we are including our Swift helper internally. this is a private header so we can include just fine.
    includes.push({
      language: 'c++',
      // Hybrid Object Swift C++ class wrapper
      name: `${HybridTSpecSwift}.hpp`,
      space: 'user',
    })
  } else {
    // it's an external type - we need to include the external module's bridge as the *Swift.hpp header is private.
    const externalBridgeName = type.sourceConfig.getSwiftBridgeHeaderName()
    const moduleName = type.sourceConfig.getIosModuleName()
    includes.push({
      language: 'c++',
      name: `${moduleName}/${externalBridgeName}.hpp`,
      space: 'system',
    })
  }

  let getImplementation: string
  let createImplementation: string
  if (!type.sourceConfig.isExternalConfig) {
    // We own the implementation - we call into Swift to convert it internally
    createImplementation = `
${swiftPartType} swiftPart = ${swiftPartType}::fromUnsafe(swiftUnsafePointer);
return std::make_shared<${swiftWrappingType}>(swiftPart);
    `.trim()
    getImplementation = `
std::shared_ptr<${swiftWrappingType}> swiftWrapper = std::dynamic_pointer_cast<${swiftWrappingType}>(cppType);
#ifdef NITRO_DEBUG
if (swiftWrapper == nullptr) [[unlikely]] {
  throw std::runtime_error("Class \\"${HybridTSpec}\\" is not implemented in Swift!");
}
#endif
${swiftPartType}& swiftPart = swiftWrapper->getSwiftPart();
return swiftPart.toUnsafe();
`.trim()
  } else {
    // It's an external type - we have to delegate the call to the external library's functions
    const cxxNamespace = type.sourceConfig.getSwiftBridgeNamespace('c++')
    const internalType = type.getCode('c++', { fullyQualified: false })
    const internalName = escapeCppName(internalType)
    createImplementation = `
// Implemented in ${type.sourceConfig.getIosModuleName()}
return ${cxxNamespace}::create_${internalName}(swiftUnsafePointer);
`.trim()
    getImplementation = `
// Implemented in ${type.sourceConfig.getIosModuleName()}
return ${cxxNamespace}::get_${internalName}(cppType);
`.trim()
  }

  return {
    cxxType: actualType,
    funcName: `create_${name}`,
    specializationName: name,
    cxxHeader: {
      code: `
/**
 * Specialized version of \`${escapeComments(actualType)}\`.
 */
using ${name} = ${actualType};
${actualType} create_${name}(void* NON_NULL swiftUnsafePointer) noexcept;
void* NON_NULL get_${name}(${name} cppType);
    `.trim(),
      requiredIncludes: type.getRequiredImports('c++'),
    },
    cxxImplementation: {
      code: `
${actualType} create_${name}(void* NON_NULL swiftUnsafePointer) noexcept {
  ${indent(createImplementation, '  ')}
}
void* NON_NULL get_${name}(${name} cppType) {
  ${indent(getImplementation, '  ')}
}
    `.trim(),
      requiredIncludes: [
        ...includes,
        {
          language: 'c++',
          name: 'NitroModules/NitroDefines.hpp',
          space: 'system',
        },
        {
          language: 'c++',
          // Swift umbrella header
          name: getUmbrellaHeaderName(),
          space: 'user',
        },
      ],
    },
    dependencies: [...upcastHelpers, createCxxWeakPtrHelper(type)],
  }
}

function createCxxUpcastHelper(
  baseType: HybridObjectType,
  childType: HybridObjectType
): SwiftCxxHelper {
  const cppBaseType = baseType.getCode('c++')
  const cppChildType = childType.getCode('c++')
  const funcName = escapeCppName(
    `upcast_${childType.hybridObjectName}_to_${baseType.hybridObjectName}`
  )
  return {
    cxxType: cppBaseType,
    funcName: funcName,
    specializationName: funcName,
    cxxHeader: {
      code: `
inline ${cppBaseType} ${funcName}(${cppChildType} child) noexcept { return child; }
`.trim(),
      requiredIncludes: [],
    },
    dependencies: [],
  }
}

function createCxxWeakPtrHelper(type: HybridObjectType): SwiftCxxHelper {
  const actualType = type.getCode('c++', { mode: 'weak' })
  const specializationName = escapeCppName(actualType)
  const funcName = `weakify_${escapeCppName(type.getCode('c++'))}`
  const parameterType = type.getCode('c++', { mode: 'strong' })
  return {
    cxxType: actualType,
    funcName: funcName,
    specializationName: specializationName,
    cxxHeader: {
      code: `
using ${specializationName} = ${actualType};
inline ${specializationName} ${funcName}(const ${parameterType}& strong) noexcept { return strong; }
`.trim(),
      requiredIncludes: [],
    },
    dependencies: [],
  }
}

/**
 * Creates a C++ `create_optional<T>(value)` function that can be called from Swift.
 */
function createCxxOptionalSwiftHelper(type: OptionalType): SwiftCxxHelper {
  const actualType = type.getCode('c++')
  const wrappedBridge = new SwiftCxxBridgedType(type.wrappingType, true)
  const name = escapeCppName(actualType)
  // TODO: Remove has_ and get_ wrappers once https://github.com/swiftlang/swift/issues/83801 is fixed.
  // TODO: Remove create_ wrapper once https://github.com/swiftlang/swift/issues/75834 is fixed.
  return {
    cxxType: actualType,
    funcName: `create_${name}`,
    specializationName: name,
    cxxHeader: {
      code: `
/**
 * Specialized version of \`${escapeComments(actualType)}\`.
 */
using ${name} = ${actualType};
inline ${actualType} create_${name}(const ${wrappedBridge.getTypeCode('c++')}& value) noexcept {
  return ${actualType}(${indent(wrappedBridge.parseFromSwiftToCpp('value', 'c++'), '    ')});
}
inline bool has_value_${name}(const ${actualType}& optional) noexcept {
  return optional.has_value();
}
inline ${wrappedBridge.getTypeCode('c++')} get_${name}(const ${actualType}& optional) noexcept {
  return optional.value();
}
    `.trim(),
      requiredIncludes: [
        {
          name: 'optional',
          space: 'system',
          language: 'c++',
        },
        ...wrappedBridge.getRequiredImports('c++'),
      ],
    },
    dependencies: [],
  }
}

/**
 * Creates a C++ `create_vector_T<T>(size)` function that can be called from Swift.
 */
function createCxxVectorSwiftHelper(type: ArrayType): SwiftCxxHelper {
  const actualType = type.getCode('c++')
  const bridgedType = new SwiftCxxBridgedType(type)
  const name = escapeCppName(actualType)
  const funcName = `create_${name}`
  const code = `
/**
 * Specialized version of \`${escapeComments(actualType)}\`.
 */
using ${name} = ${actualType};
inline ${actualType} create_${name}(size_t size) noexcept {
  ${actualType} vector;
  vector.reserve(size);
  return vector;
}`.trim()

  return {
    cxxType: actualType,
    funcName: funcName,
    specializationName: name,
    cxxHeader: {
      code: code,
      requiredIncludes: [
        {
          name: 'vector',
          space: 'system',
          language: 'c++',
        },
        ...bridgedType.getRequiredImports('c++'),
      ],
    },
    dependencies: [],
  }
}

/**
 * Creates a C++ `makeUnorderedMap<T>(size)` function that can be called from Swift.
 */
function createCxxUnorderedMapSwiftHelper(type: RecordType): SwiftCxxHelper {
  const actualType = type.getCode('c++')
  const bridgedType = new SwiftCxxBridgedType(type)
  const name = escapeCppName(actualType)
  const keyType = type.keyType.getCode('c++')
  const valueType = type.valueType.getCode('c++')
  return {
    cxxType: actualType,
    funcName: `create_${name}`,
    specializationName: name,
    cxxHeader: {
      code: `
/**
 * Specialized version of \`${escapeComments(actualType)}\`.
 */
using ${name} = ${actualType};
inline ${actualType} create_${name}(size_t size) noexcept {
  ${actualType} map;
  map.reserve(size);
  return map;
}
inline std::vector<${keyType}> get_${name}_keys(const ${name}& map) noexcept {
  std::vector<${keyType}> keys;
  keys.reserve(map.size());
  for (const auto& entry : map) {
    keys.push_back(entry.first);
  }
  return keys;
}
inline ${valueType} get_${name}_value(const ${name}& map, const ${keyType}& key) noexcept {
  return map.find(key)->second;
}
inline void emplace_${name}(${name}& map, const ${keyType}& key, const ${valueType}& value) noexcept {
  map.emplace(key, value);
}
      `.trim(),
      requiredIncludes: [
        {
          name: 'unordered_map',
          space: 'system',
          language: 'c++',
        },
        ...bridgedType.getRequiredImports('c++'),
      ],
    },
    dependencies: [],
  }
}

/**
 * Creates a C++ `Func_XXXXX` specialization that can be used from Swift.
 */
function createCxxFunctionSwiftHelper(type: FunctionType): SwiftCxxHelper {
  const actualType = type.getCode('c++')
  const bridgedType = new SwiftCxxBridgedType(type)
  const returnBridge = new SwiftCxxBridgedType(type.returnType)
  const paramsSignature = type.parameters.map((p) => {
    if (p.canBePassedByReference) {
      return `${toReferenceType(p.getCode('c++'))} ${p.escapedName}`
    } else {
      return `${p.getCode('c++')} ${p.escapedName}`
    }
  })
  const paramsForward = type.parameters.map((p) => {
    const bridge = new SwiftCxxBridgedType(p)
    return bridge.parseFromCppToSwift(p.escapedName, 'c++')
  })
  const name = type.specializationName
  const wrapperName = `${name}_Wrapper`
  const swiftClassName = `${NitroConfig.current.getIosModuleName()}::${type.specializationName}`

  const callParamsForward = type.parameters.map((p) => {
    const bridge = new SwiftCxxBridgedType(p)
    return bridge.parseFromSwiftToCpp(p.escapedName, 'c++')
  })

  const callFuncReturnType = returnBridge.getTypeCode('c++')
  const callCppFuncParamsSignature = type.parameters.map((p) => {
    const bridge = new SwiftCxxBridgedType(p)
    const cppType = bridge.getTypeCode('c++')
    return `${cppType} ${p.escapedName}`
  })
  let callCppFuncBody: string
  if (returnBridge.hasType) {
    callCppFuncBody = `
auto __result = _function->operator()(${callParamsForward.join(', ')});
return ${returnBridge.parseFromCppToSwift('__result', 'c++')};
    `.trim()
  } else {
    callCppFuncBody = `_function->operator()(${callParamsForward.join(', ')});`
  }

  let body: string
  if (type.returnType.kind === 'void') {
    body = `
swiftClosure.call(${paramsForward.join(', ')});
`.trim()
  } else {
    body = `
auto __result = swiftClosure.call(${paramsForward.join(', ')});
return ${returnBridge.parseFromSwiftToCpp('__result', 'c++')};
    `.trim()
  }

  // TODO: Remove our std::function wrapper once https://github.com/swiftlang/swift/issues/75844 is fixed.
  return {
    cxxType: actualType,
    funcName: `create_${name}`,
    specializationName: name,
    cxxHeader: {
      code: `
/**
 * Specialized version of \`${type.getCode('c++', { includeNameInfo: false })}\`.
 */
using ${name} = ${actualType};
/**
 * Wrapper class for a \`${escapeComments(actualType)}\`, this can be used from Swift.
 */
class ${wrapperName} final {
public:
  explicit ${wrapperName}(${actualType}&& func): _function(std::make_unique<${actualType}>(std::move(func))) {}
  inline ${callFuncReturnType} call(${callCppFuncParamsSignature.join(', ')}) const noexcept {
    ${indent(callCppFuncBody, '    ')}
  }
private:
  std::unique_ptr<${actualType}> _function;
} SWIFT_NONCOPYABLE;
${name} create_${name}(void* NON_NULL swiftClosureWrapper) noexcept;
inline ${wrapperName} wrap_${name}(${name} value) noexcept {
  return ${wrapperName}(std::move(value));
}
    `.trim(),
      requiredIncludes: [
        {
          name: 'functional',
          space: 'system',
          language: 'c++',
        },
        {
          name: 'memory',
          space: 'system',
          language: 'c++',
        },
        ...bridgedType.getRequiredImports('c++'),
      ],
    },
    cxxImplementation: {
      code: `
${name} create_${name}(void* NON_NULL swiftClosureWrapper) noexcept {
  auto swiftClosure = ${swiftClassName}::fromUnsafe(swiftClosureWrapper);
  return [swiftClosure = std::move(swiftClosure)](${paramsSignature.join(', ')}) mutable -> ${type.returnType.getCode('c++')} {
    ${indent(body, '    ')}
  };
}
`.trim(),
      requiredIncludes: [
        {
          language: 'c++',
          // Swift umbrella header
          name: getUmbrellaHeaderName(),
          space: 'user',
        },
      ],
    },
    dependencies: [],
  }
}

/**
 * Creates multiple C++ `create_variant_A_B_C<A, B, C>(A...)` functions that can be called from Swift.
 */
function createCxxVariantSwiftHelper(type: VariantType): SwiftCxxHelper {
  const actualType = type.getCode('c++')
  const bridgedType = new SwiftCxxBridgedType(type)
  const name = escapeCppName(actualType)
  const createFunctions = type.variants.map((t) => {
    const param = t.canBePassedByReference
      ? toReferenceType(t.getCode('c++'))
      : t.getCode('c++')

    return `
inline ${name} create_${name}(${param} value) noexcept {
  return ${name}(value);
}
      `.trim()
  })
  const getFunctions = type.variants.map((t, i) => {
    return `
inline ${t.getCode('c++')} get_${i}() const noexcept {
  return std::get<${i}>(variant);
}`.trim()
  })
  return {
    cxxType: actualType,
    funcName: `create_${name}`,
    specializationName: name,
    cxxHeader: {
      code: `
/**
 * Wrapper struct for \`${escapeComments(actualType)}\`.
 * std::variant cannot be used in Swift because of a Swift bug.
 * Not even specializing it works. So we create a wrapper struct.
 */
struct ${name} final {
  ${actualType} variant;
  ${name}(${actualType} variant): variant(variant) { }
  operator ${actualType}() const noexcept {
    return variant;
  }
  inline size_t index() const noexcept {
    return variant.index();
  }
  ${indent(getFunctions.join('\n'), '  ')}
};
${createFunctions.join('\n')}
        `.trim(),

      requiredIncludes: [
        {
          name: 'variant',
          space: 'system',
          language: 'c++',
        },
        ...bridgedType.getRequiredImports('c++'),
      ],
    },
    dependencies: [],
  }
}

/**
 * Creates a C++ `create_tuple_A_B_C<A, B, C>(A, B, C)` function that can be called from Swift.
 */
function createCxxTupleSwiftHelper(type: TupleType): SwiftCxxHelper {
  const actualType = type.getCode('c++')
  const bridgedType = new SwiftCxxBridgedType(type)
  const name = escapeCppName(actualType)
  const typesSignature = type.itemTypes
    .map((t, i) => {
      const code = t.getCode('c++')
      return `${t.canBePassedByReference ? toReferenceType(code) : code} arg${i}`
    })
    .join(', ')
  const typesForward = type.itemTypes.map((_t, i) => `arg${i}`).join(', ')
  return {
    cxxType: actualType,
    funcName: `create_${name}`,
    specializationName: name,
    cxxHeader: {
      code: `
/**
 * Specialized version of \`${escapeComments(actualType)}\`.
 */
using ${name} = ${actualType};
inline ${actualType} create_${name}(${typesSignature}) noexcept {
  return ${actualType} { ${typesForward} };
}
     `.trim(),
      requiredIncludes: [
        {
          name: 'tuple',
          space: 'system',
          language: 'c++',
        },
        ...bridgedType.getRequiredImports('c++'),
      ],
    },
    dependencies: [],
  }
}

/**
 * Create a C++ `create_result` function that can be called from Swift to create a `Result<T>`.
 */
function createCxxResultWrapperSwiftHelper(
  type: ResultWrappingType
): SwiftCxxHelper {
  // TODO: Remove the ResultWrappingType once https://github.com/swiftlang/swift/issues/75290 is fixed.
  const actualType = type.getCode('c++')
  const name = escapeCppName(type.getCode('c++'))
  const funcName = `create_${name}`

  const functions: string[] = []
  if (type.result.kind === 'void') {
    functions.push(
      `
inline ${name} ${funcName}() noexcept {
  return ${actualType}::withValue();
}`.trim()
    )
  } else {
    const typeParam = type.result.canBePassedByReference
      ? `const ${type.result.getCode('c++')}&`
      : type.result.getCode('c++')
    functions.push(
      `
inline ${name} ${funcName}(${typeParam} value) noexcept {
  return ${actualType}::withValue(${type.result.canBePassedByReference ? 'value' : 'std::move(value)'});
}`.trim()
    )
  }
  functions.push(
    `
inline ${name} ${funcName}(const ${type.error.getCode('c++')}& error) noexcept {
  return ${actualType}::withError(error);
}`.trim()
  )

  return {
    cxxType: actualType,
    specializationName: name,
    funcName: funcName,
    cxxHeader: {
      code: `
using ${name} = ${actualType};
${functions.join('\n')}
      `.trim(),
      requiredIncludes: type.getRequiredImports('c++'),
    },
    dependencies: [],
  }
}

/**
 * Creates a C++ `create_promise_T()` function that can be called from Swift to create a `std::shared_ptr<Promise<T>>`.
 */
function createCxxPromiseSwiftHelper(type: PromiseType): SwiftCxxHelper {
  const resultingType = type.resultingType.getCode('c++')
  const bridgedType = new SwiftCxxBridgedType(type)
  const actualType = `std::shared_ptr<Promise<${resultingType}>>`

  const resolverArgs: NamedType[] = []
  if (type.resultingType.kind !== 'void') {
    resolverArgs.push(new NamedWrappingType('result', type.resultingType))
  }
  const resolveFunction = new FunctionType(new VoidType(), resolverArgs)
  const rejectFunction = new FunctionType(new VoidType(), [
    new NamedWrappingType('error', new ErrorType()),
  ])

  const name = escapeCppName(actualType)
  return {
    cxxType: actualType,
    funcName: `create_${name}`,
    specializationName: name,
    cxxHeader: {
      code: `
/**
 * Specialized version of \`${escapeComments(actualType)}\`.
 */
using ${name} = ${actualType};
inline ${actualType} create_${name}() noexcept {
  return Promise<${resultingType}>::create();
}
inline PromiseHolder<${resultingType}> wrap_${name}(${actualType} promise) noexcept {
  return PromiseHolder<${resultingType}>(std::move(promise));
}
       `.trim(),
      requiredIncludes: [
        {
          name: 'NitroModules/PromiseHolder.hpp',
          space: 'system',
          language: 'c++',
        },
        ...bridgedType.getRequiredImports('c++'),
      ],
    },
    dependencies: [
      createCxxFunctionSwiftHelper(resolveFunction),
      createCxxFunctionSwiftHelper(rejectFunction),
    ],
  }
}
