import { indent } from '../../utils.js'
import { getUmbrellaHeaderName } from '../../autolinking/ios/createSwiftUmbrellaHeader.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { createFileMetadataString } from '../helpers.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { getHybridObjectBridgeNames } from './SwiftHybridObjectHelpers.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { SwiftHybridObjectType } from './types/SwiftHybridObjectType.js'

import { SwiftInstanceMethod } from './SwiftInstanceMethod.js'
import { SwiftStaticMethod } from './SwiftStaticMethod.js'
import { SwiftStaticProperty } from './SwiftStaticProperty.js'
import { SwiftConstructor } from './SwiftConstructor.js'
import { getImportCode, getImportsCode } from '../getImportCode.js'
import {
  getProtocolConformanceImports,
  getSwiftImports,
} from './getSwiftImports.js'
import type { SwiftMethodBridge } from './SwiftMethodHelpers.js'

function getCxxPartName(type: HybridObjectType): string {
  const name = getHybridObjectName(type.hybridObjectName).HybridTSpecSwift
  if (type.sourceConfig.isExternalConfig) {
    return type.sourceConfig.getCxxNamespace('c++', name)
  }
  return name
}

/**
 * Returns all direct and indirect base types of the given {@linkcode type},
 * starting at the root. C++ constructs virtual bases in this order.
 */
function getBaseTypesFromRoot(type: HybridObjectType): HybridObjectType[] {
  return type.baseTypes.flatMap((base) => [...getBaseTypesFromRoot(base), base])
}

export function createSwiftHybridObjectCxxBridge(
  spec: HybridObjectSpec<'swift'>
): SourceFile[] {
  const hybridObjectNames = getHybridObjectName(spec.name)
  const swiftModuleName = spec.config.getIosModuleName()
  const cppNamespace = spec.config.getCxxNamespace('c++')
  const type = new HybridObjectType(spec)
  const bridgeNames = getHybridObjectBridgeNames(type)
  const baseHybridObjects = type.baseTypes.map((base) => {
    const name = getHybridObjectName(base.hybridObjectName)
    const cppImport: SourceImport = {
      language: 'c++',
      declaration: new SwiftHybridObjectType(base).getCxxPartHeader(),
    }
    return {
      name: name,
      type: base,
      cppName: getCxxPartName(base),
      cppImport: cppImport,
    }
  })
  const baseHybridObject = baseHybridObjects[0]
  const hasBase = baseHybridObjects.length > 0
  let swiftSuperclass: string
  if (baseHybridObject != null) {
    swiftSuperclass = `: ${baseHybridObject.name.HybridTSpecCxx}`
  } else {
    swiftSuperclass = ''
  }
  const cppBaseImports = getImportsCode(
    baseHybridObjects.map((base) => base.cppImport)
  )
  let hybridClassBase: string
  if (baseHybridObject != null) {
    hybridClassBase = baseHybridObject.cppName
  } else {
    hybridClassBase = 'HybridObject'
  }
  let swiftImplementationType: string
  let swiftImplementationAssignment: string
  if (spec.implementation != null && !spec.allowMultipleImplementations) {
    swiftImplementationType = spec.implementation.className
    swiftImplementationAssignment = `
guard let implementation = implementation as? ${swiftImplementationType} else {
  preconditionFailure("${spec.name} selects ${swiftImplementationType} as its Swift implementation. Every instance must inherit ${swiftImplementationType}.")
}
self.__implementation = implementation
`.trim()
  } else {
    swiftImplementationType = `any ${hybridObjectNames.HybridTSpec}`
    swiftImplementationAssignment = 'self.__implementation = implementation'
  }
  const cppFinality = spec.allowInheritance ? '' : ' final'
  const swiftClassDeclaration = spec.allowInheritance
    ? 'open class'
    : 'public final class'
  const swiftMemberAccess = spec.allowInheritance ? 'open' : 'public'
  const swiftOverrideModifier = hasBase ? 'override ' : ''
  const cppClassName = hybridObjectNames.HybridTSpecSwift
  const cppHeaderDeclarations: string[] = []
  const cppMethodImplementations: string[] = []
  const swiftMethodImplementations: string[] = []
  const swiftRequiredImports: SourceImport[] = []
  const cppMethodRegistrations: string[] = []
  const callableGroups: { name: string; bridges: SwiftMethodBridge[] }[] = []
  const properties: SwiftInstanceMethod[] = []
  for (const property of spec.properties) {
    const getter = new SwiftInstanceMethod({
      method: property.cppGetter,
      accessor: { kind: 'getter', name: property.name },
    })
    properties.push(getter)
    const accessors = [`&${cppClassName}::${getter.name}`]
    if (property.cppSetter != null) {
      const setter = new SwiftInstanceMethod({
        method: property.cppSetter,
        accessor: { kind: 'setter', name: property.name },
      })
      properties.push(setter)
      accessors.push(`&${cppClassName}::${setter.name}`)
    }
    cppMethodRegistrations.push(
      `clazz.registerHybridProperty("${property.name}", ${accessors.join(', ')});`
    )
  }
  callableGroups.push({
    name: 'Properties',
    bridges: properties.map((property) => property.createBridge(cppClassName)),
  })
  callableGroups.push({
    name: 'Methods',
    bridges: spec.methods.map((method) =>
      new SwiftInstanceMethod({ method: method }).createBridge(cppClassName)
    ),
  })
  const { constructor, staticMethods, staticProperties } =
    getSwiftClassMembers(spec)
  const inheritedClassMethods = new Set(
    spec.baseTypes.flatMap((base) =>
      getSwiftClassMethodDeclarations(base, swiftModuleName)
    )
  )
  const createClassMethodBridge = (
    callable: SwiftConstructor | SwiftStaticMethod
  ): SwiftMethodBridge => {
    const declaration = getSwiftClassMethodDeclaration(callable, cppClassName)
    return callable.createBridge(cppClassName, {
      override: inheritedClassMethods.has(declaration),
    })
  }
  if (constructor != null) {
    callableGroups.push({
      name: 'Constructor',
      bridges: [createClassMethodBridge(constructor)],
    })
  }
  if (staticMethods.length > 0) {
    callableGroups.push({
      name: 'Static methods',
      bridges: staticMethods.map(createClassMethodBridge),
    })
  }
  if (staticProperties.length > 0) {
    callableGroups.push({
      name: 'Static properties',
      bridges: staticProperties.flatMap((property) =>
        property.createBridges(inheritedClassMethods)
      ),
    })
    for (const property of staticProperties) {
      cppMethodRegistrations.push(property.getCppRegistration(cppClassName))
    }
  }

  for (const { name, bridges } of callableGroups) {
    const comment = `// ${name}`
    cppHeaderDeclarations.push(comment)
    cppMethodImplementations.push(comment)
    swiftMethodImplementations.push(comment)
    const cppMethods = bridges.flatMap((bridge) => bridge.cppMethods)
    const swiftMethods = bridges.map((bridge) => bridge.swiftMethod)
    for (const { method, body } of cppMethods) {
      cppHeaderDeclarations.push(method.getDeclaration('c++'))
      cppMethodImplementations.push(
        method.getDefinition('c++', {
          placement: 'out-of-class',
          className: cppClassName,
          body: body,
        })
      )
    }
    for (const { method, body } of swiftMethods) {
      swiftMethodImplementations.push(
        method.getDefinition('swift', { body: body })
      )
    }
    swiftRequiredImports.push(
      ...bridges.flatMap((bridge) => bridge.swiftImports)
    )
    cppMethodRegistrations.push(
      ...bridges.flatMap((bridge) => bridge.cppRegistrations)
    )
  }

  if (spec.isHybridView) {
    const implementation = spec.implementation
    if (implementation == null) {
      throw new Error(
        `${spec.name}: A HybridView needs a Swift implementation class.`
      )
    }
    swiftMethodImplementations.push(
      `
// Fabric creates views on the UI thread, independently of JavaScript constructors.
public static func create${spec.name}View() -> bridge.${bridgeNames.strong} {
  return ${implementation.className}().getCxxWrapper().getCxxPart()
}

public static func is${spec.name}Recyclable() -> Bool {
  return ${implementation.className}.self is any RecyclableView.Type
}
`.trim()
    )
    if (!spec.baseTypes.some((base) => base.isHybridView)) {
      swiftMethodImplementations.push(
        `
public final func getView() -> UnsafeMutableRawPointer {
  return Unmanaged.passRetained(__implementation.view).toOpaque()
}

public final func beforeUpdate() {
  __implementation.beforeUpdate()
}

public final func afterUpdate() {
  __implementation.afterUpdate()
}

public final func maybePrepareForRecycle() {
  guard let recyclable = __implementation as? any RecyclableView else { return }
  recyclable.prepareForRecycle()
}

public final func onDropView() {
  __implementation.onDropView()
}
`.trim()
      )
    }
  }

  const swiftBaseOverrides = baseHybridObjects.map((base) =>
    `
// C++ uses the accessor for this spec. Keep base upcasts in Swift to avoid
// exporting the same imported pointer metadata from two Swift modules.
@_expose(!Cxx)
${swiftMemberAccess} override func getCxxPart() -> bridge.${getHybridObjectBridgeNames(base.type).strong} {
  let own: bridge.${bridgeNames.strong} = getCxxPart()
  return bridge.upcast_${spec.name}_to_${base.type.hybridObjectName}(own)
}
`.trim()
  )
  // A concrete implementation's members can resolve to extensions of the
  // protocols the spec or its bases conform to, and MemberImportVisibility
  // requires the modules declaring them.
  const conformanceTypes = [type, ...getBaseTypesFromRoot(type)]
  const conformances = conformanceTypes.flatMap((conformanceType) =>
    new SwiftHybridObjectType(conformanceType).getProtocolConformances()
  )
  const conformanceImports = getProtocolConformanceImports(
    conformances,
    'internal'
  )
  const swiftImports = getImportsCode([
    { language: 'swift', name: 'NitroModules', access: 'internal' },
    { language: 'swift', name: 'CxxStdlib', access: 'internal' },
    {
      language: 'swift',
      name: `${swiftModuleName}AppleCxx`,
      access: 'public',
    },
    ...getSwiftImports(type.baseTypes, 'public'),
    ...getSwiftImports(
      [
        ...spec.methods,
        ...spec.properties,
        ...spec.staticMethods,
        ...spec.staticProperties,
      ],
      'internal'
    ),
    ...(spec.constructor?.getRequiredImports('swift') ?? []),
    ...swiftRequiredImports,
    ...conformanceImports,
  ])
  const swiftCode = `
${createFileMetadataString(`${hybridObjectNames.HybridTSpecCxx}.swift`)}
${swiftImports}

/**
 * A class implementation that bridges ${hybridObjectNames.HybridTSpec} over to C++.
 * In C++, we cannot use Swift protocols - so we need to wrap it in a class to make it strongly defined.
 */
@_expose(Cxx)
${swiftClassDeclaration} ${hybridObjectNames.HybridTSpecCxx}${swiftSuperclass} {
  /**
   * The Swift <> C++ bridge's namespace (\`${spec.config.getSwiftBridgeNamespace('c++')}\`)
   * from \`${spec.config.getAppleCxxHeader().name}\`.
   * This contains specialized C++ templates, and C++ helper functions that can be accessed from Swift.
   */
  public typealias bridge = ${spec.config.getSwiftBridgeNamespace('swift')}

  /**
   * Holds the Swift implementation of \`${hybridObjectNames.HybridTSpec}\`.
   */
  private let __implementation: ${swiftImplementationType}

  /**
   * Holds a weak pointer to the C++ class that wraps the Swift class.
   */
  private var __cxxPart: bridge.${bridgeNames.weak} = .init()

  /**
   * Create a new \`${hybridObjectNames.HybridTSpecCxx}\` that wraps the given \`${hybridObjectNames.HybridTSpec}\`.
   */
  public init(_ implementation: any ${hybridObjectNames.HybridTSpec}) {
    ${indent(swiftImplementationAssignment, '    ')}
    ${hasBase ? 'super.init(implementation)' : ''}
  }

  /**
   * Get the actual \`${hybridObjectNames.HybridTSpec}\` instance this class wraps.
   */
  @inline(__always)
  public func get${hybridObjectNames.HybridTSpec}() -> any ${hybridObjectNames.HybridTSpec} {
    return __implementation
  }

  /**
   * Casts this instance to a retained unsafe raw pointer.
   * This acquires one additional strong reference on the object!
   */
  ${swiftMemberAccess} ${swiftOverrideModifier}func toUnsafe() -> UnsafeMutableRawPointer {
    return Unmanaged.passRetained(self).toOpaque()
  }

  /**
   * Casts an unsafe pointer to a \`${hybridObjectNames.HybridTSpecCxx}\`.
   * The pointer has to be a retained opaque \`Unmanaged<${hybridObjectNames.HybridTSpecCxx}>\`.
   * This removes one strong reference from the object!
   */
  ${swiftMemberAccess} ${swiftOverrideModifier}class func fromUnsafe(pointer: UnsafeMutableRawPointer) -> ${hybridObjectNames.HybridTSpecCxx} {
    return Unmanaged<${hybridObjectNames.HybridTSpecCxx}>.fromOpaque(pointer).takeRetainedValue()
  }

  /**
   * Gets (or creates) the C++ part of this Hybrid Object.
   * The C++ part is a \`${type.getCode('c++', { context: 'value' })}\`.
   */
  ${swiftMemberAccess} func getCxxPart() -> bridge.${bridgeNames.strong} {
    let cached = __cxxPart.lock()
    if cached.use_count() > 0 {
      return cached
    }
    let value = bridge.${bridgeNames.create}(self.toUnsafe())
    __cxxPart = bridge.${bridgeNames.weakify}(value)
    return value
  }
  ${indent(swiftBaseOverrides.join('\n'), '  ')}

  // A static borrowing accessor lets C++ pass a const reference without copying it.
  // TODO: Remove this adapter and call the instance method directly once
  // https://github.com/swiftlang/swift/pull/92862 is merged and supported by our Swift toolchain.
  @_spi(NitroCxx)
  public static func getCxxPart(_ value: borrowing ${hybridObjectNames.HybridTSpecCxx}) -> bridge.${bridgeNames.strong} {
    return value.getCxxPart()
  }

  /**
   * Get the memory size of the Swift class (plus size of any other allocations)
   * so the JS VM can properly track it and garbage-collect the JS object if needed.
   */
  @inline(__always)
  ${swiftMemberAccess} ${swiftOverrideModifier}var memorySize: Int {
    return MemoryHelper.getSizeOf(__implementation) + __implementation.memorySize
  }

  /**
   * Compares this object with the given [other] object for reference equality.
   */
  @inline(__always)
  public func equals(other: ${hybridObjectNames.HybridTSpecCxx}) -> Bool {
    return __implementation === other.__implementation
  }

  /**
   * Call dispose() on the Swift class.
   * This _may_ be called manually from JS.
   */
  @inline(__always)
  ${swiftMemberAccess} ${swiftOverrideModifier}func dispose() {
    __implementation.dispose()
  }

  /**
   * Call toString() on the Swift class.
   */
  @inline(__always)
  ${swiftMemberAccess} ${swiftOverrideModifier}func toString() -> String {
    return __implementation.toString()
  }

  ${indent(swiftMethodImplementations.join('\n\n'), '  ')}
}
`.trim()
  const cppBaseClasses = [
    `public virtual ${hybridObjectNames.HybridTSpec}`,
    ...baseHybridObjects.map((base) => `public virtual ${base.cppName}`),
  ]
  // The most derived class initializes every virtual base, including indirect ones.
  const cppVirtualBaseNames = getBaseTypesFromRoot(type).map(getCxxPartName)
  const cppConstructorInitializers = [
    ...cppVirtualBaseNames.map((name) => `${name}(swiftPart)`),
    '_swiftPart(swiftPart)',
  ]
  const cppClassDeclaration = `
/**
 * The C++ part of ${hybridObjectNames.HybridTSpecCxx}.swift.
 *
 * ${hybridObjectNames.HybridTSpecSwift} accesses the concrete Swift wrapper and registers
 * its Swift signatures for JS. The base spec keeps the public C++ signatures.
 *
 * Once Swift can inherit from C++ classes, the Swift implementation could
 * inherit ${hybridObjectNames.HybridTSpec} directly to simplify this structure.
 */
class ${hybridObjectNames.HybridTSpecSwift}${cppFinality} : ${cppBaseClasses.join(', ')} {
public:
  struct Class {
    using Base = ${hybridClassBase}::Class;
    static constexpr const char* name = "${spec.name}";
    static const std::shared_ptr<const HybridClass>& get();
  };

public:
  // Constructor from a Swift instance
  explicit ${hybridObjectNames.HybridTSpecSwift}(const ${swiftModuleName}::${hybridObjectNames.HybridTSpecCxx}& swiftPart):
    ${indent(cppConstructorInitializers.join(',\n'), '    ')} { }

public:
  // Get the Swift part
  ${swiftModuleName}::${hybridObjectNames.HybridTSpecCxx}& getSwiftPart() noexcept {
    return _swiftPart;
  }

  // HybridObject overrides
  size_t getExternalMemorySize() noexcept override {
    return _swiftPart.getMemorySize();
  }
  bool equals(const std::shared_ptr<HybridObject>& other) override {
    auto value = std::dynamic_pointer_cast<${hybridObjectNames.HybridTSpecSwift}>(other);
    return value && _swiftPart.equals(value->_swiftPart);
  }
  void dispose() override {
    _swiftPart.dispose();
  }
  std::string toString() override;

  ${indent(cppHeaderDeclarations.join('\n'), '  ')}

protected:
  const std::shared_ptr<const HybridClass>& getHybridClass() override {
    return Class::get();
  }

private:
  ${swiftModuleName}::${hybridObjectNames.HybridTSpecCxx} _swiftPart;
};
`.trim()
  const cppImports = getImportsCode(
    [
      {
        language: 'c++',
        declaration: type.getCppHeader(),
      },
      ...spec.staticMethods.flatMap((method) =>
        method.getRequiredImports('c++')
      ),
      ...spec.staticProperties.flatMap((property) =>
        property.getRequiredImports('c++')
      ),
      ...(spec.constructor?.getRequiredImports('c++') ?? []),
      {
        language: 'c++',
        declaration: {
          name: 'NitroModules/HybridClass.hpp',
          space: 'system',
        },
      },
    ],
    'implementation'
  )
  const cppUmbrellaInclude = getImportCode({
    language: 'c++',
    declaration: spec.config.getCxxHeader(getUmbrellaHeaderName(), 'private'),
  })
  const cppImplementationInclude = getImportCode({
    language: 'c++',
    declaration: spec.config.getCxxHeader(
      `${hybridObjectNames.HybridTSpecSwift}.hpp`,
      'private'
    ),
  })
  const cppHeaderCode = `
${createFileMetadataString(`${hybridObjectNames.HybridTSpecSwift}.hpp`)}

#pragma once

${cppImports}
${cppBaseImports}

// This implementation header is consumed only by C++ translation units.
${cppUmbrellaInclude}

namespace ${cppNamespace} {

  ${indent(cppClassDeclaration, '  ')}

} // namespace ${cppNamespace}
`.trim()
  const cppClassImplementation = `
std::string ${hybridObjectNames.HybridTSpecSwift}::toString() {
  return SwiftConverter<std::string, swift::String>::fromSwift(_swiftPart.toString());
}

${cppMethodImplementations.join('\n\n')}

const std::shared_ptr<const HybridClass>& ${hybridObjectNames.HybridTSpecSwift}::Class::get() {
  static const auto hybridClass = HybridClass::create<Class>([](HybridClass& clazz) {
    ${indent(cppMethodRegistrations.join('\n'), '    ')}
  });
  return hybridClass;
}

`.trim()
  const cppImplementationCode = `
${createFileMetadataString(`${hybridObjectNames.HybridTSpecSwift}.cpp`)}

${cppImplementationInclude}
#include <NitroModules/SwiftConverter.hpp>
#include <NitroModules/SwiftResult.hpp>
#include <optional>

namespace ${cppNamespace} {

  ${indent(cppClassImplementation, '  ')}

} // namespace ${cppNamespace}
`.trim()
  return [
    {
      name: `${hybridObjectNames.HybridTSpecCxx}.swift`,
      content: swiftCode,
      language: 'swift',
      platform: 'ios',
      subdirectory: [],
    },
    {
      name: `${hybridObjectNames.HybridTSpecSwift}.hpp`,
      content: cppHeaderCode,
      language: 'c++',
      platform: 'ios',
      subdirectory: [],
    },
    {
      name: `${hybridObjectNames.HybridTSpecSwift}.cpp`,
      content: cppImplementationCode,
      language: 'c++',
      platform: 'ios',
      subdirectory: [],
    },
  ]
}

interface SwiftClassMembers {
  constructor: SwiftConstructor | undefined
  staticMethods: SwiftStaticMethod[]
  staticProperties: SwiftStaticProperty[]
}

/** The constructor and static accessors and methods C++ calls on the spec's `_cxx` class. */
function getSwiftClassMembers(
  spec: HybridObjectSpec<'swift'>
): SwiftClassMembers {
  let constructor: SwiftConstructor | undefined
  if (spec.constructor != null) {
    constructor = new SwiftConstructor({
      spec: spec,
      constructor: spec.constructor,
    })
  }
  const staticMethods = spec.staticMethods.map(
    (method) => new SwiftStaticMethod({ spec: spec, method: method })
  )
  const staticProperties = spec.staticProperties.map(
    (property) => new SwiftStaticProperty({ spec: spec, property: property })
  )
  return {
    constructor: constructor,
    staticMethods: staticMethods,
    staticProperties: staticProperties,
  }
}

/** The `_cxx` declaration of a constructor or static method, before inheritance modifiers. */
function getSwiftClassMethodDeclaration(
  callable: SwiftConstructor | SwiftStaticMethod,
  cppClassName: string
): string {
  const { swiftMethod } = callable.createBridge(cppClassName)
  return swiftMethod.method.getDeclaration('swift')
}

/**
 * The `_cxx` classes declare constructors and static methods as `class func`s.
 * A derived `_cxx` class must override the ones it redeclares with the same
 * signature. Bases from other Swift modules never match, since each module's
 * bridge declares its own result types.
 */
function getSwiftClassMethodDeclarations(
  spec: HybridObjectSpec,
  swiftModuleName: string
): string[] {
  if (
    spec.language !== 'swift' ||
    spec.config.getIosModuleName() !== swiftModuleName
  ) {
    return []
  }
  const { constructor, staticMethods, staticProperties } =
    getSwiftClassMembers(spec)
  const callables: (SwiftConstructor | SwiftStaticMethod)[] = []
  if (constructor != null) callables.push(constructor)
  callables.push(...staticMethods)
  const { HybridTSpecSwift } = getHybridObjectName(spec.name)
  const ownDeclarations = callables.map((callable) =>
    getSwiftClassMethodDeclaration(callable, HybridTSpecSwift)
  )
  ownDeclarations.push(
    ...staticProperties.flatMap((property) =>
      property
        .createBridges()
        .map(({ swiftMethod }) => swiftMethod.method.getDeclaration('swift'))
    )
  )
  const inheritedDeclarations = spec.baseTypes.flatMap((base) =>
    getSwiftClassMethodDeclarations(base, swiftModuleName)
  )
  return [...ownDeclarations, ...inheritedDeclarations]
}
