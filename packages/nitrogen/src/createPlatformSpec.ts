import { Node, Scope, Type } from 'ts-morph'
import type { SourceFile } from './syntax/SourceFile.js'
import { createCppHybridObject } from './syntax/c++/CppHybridObject.js'
import {
  isSomeHybridObject,
  isHybridView,
  isHybridViewBaseClass,
  type Platform,
  type HybridObjectPlatformOptions,
  getHybridObjectPlatformsForType,
} from './getPlatformSpecs.js'
import type { HybridObjectSpec } from './syntax/HybridObjectSpec.js'
import { Property } from './syntax/Property.js'
import { StaticProperty } from './syntax/StaticProperty.js'
import { InstanceMethod } from './syntax/InstanceMethod.js'
import { HybridObjectType } from './syntax/types/HybridObjectType.js'
import { getHybridObjectName } from './syntax/getHybridObjectName.js'
import { StaticMethod } from './syntax/StaticMethod.js'
import { Constructor } from './syntax/Constructor.js'
import { createSwiftHybridObject } from './syntax/swift/SwiftHybridObject.js'
import { createKotlinHybridObject } from './syntax/kotlin/KotlinHybridObject.js'
import { createType, type TypeParsingTarget } from './syntax/createType.js'
import { Parameter } from './syntax/Parameter.js'
import { getDirectBaseTypes, getHybridObjectNitroModuleConfig } from './utils.js'
import { NitroConfig } from './config/NitroConfig.js'
import { isMemberOverridingFromBase } from './syntax/isMemberOverridingFromBase.js'

export function generatePlatformFiles(
  hybridType: Type,
  platform: Platform,
  options: HybridObjectPlatformOptions
): { spec: HybridObjectSpec; files: SourceFile[] } {
  const spec = getHybridObjectSpec(hybridType, platform, options)
  const language = options.language

  switch (spec.language) {
    case 'c++':
      return { spec: spec, files: generateCppFiles(spec, platform) }
    case 'swift':
      return { spec: spec, files: generateSwiftFiles(spec) }
    case 'kotlin':
      return { spec: spec, files: generateKotlinFiles(spec) }
    default:
      throw new Error(`Language "${language}" is not supported!`)
  }
}

export function getHybridObjectSpec(
  type: Type,
  platform: Platform,
  options: HybridObjectPlatformOptions,
  target: TypeParsingTarget = { language: options.language, platform: platform }
): HybridObjectSpec {
  const language = options.language
  const platforms = getHybridObjectPlatformsForType(type)
  const config = getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current
  const view = isHybridView(type)

  const symbol = type.getSymbolOrThrow()
  const name = symbol.getEscapedName()
  const typeDeclarations = symbol.getDeclarations()
  if (typeDeclarations.length > 1) {
    throw new Error(`${name}: HybridObject declaration merging is not supported. Declare all native members in a single class.`)
  }
  let constructorParameters: Parameter[] | undefined
  const declaration = typeDeclarations[0]
  if (!Node.isClassDeclaration(declaration)) {
    throw new Error(`${name}: HybridObject specs must be declared as classes.`)
  }
  const fileName = declaration.getSourceFile().getBaseName()
  const expectedSyntax = `Use \`export declare class ${name}\` in a .nitro.ts spec.`
  // Base classes from built packages are declared in tsc's .nitro.d.ts output.
  const isSpecFile = fileName.endsWith('.nitro.ts') || fileName.endsWith('.nitro.d.ts')
  if (!isSpecFile) {
    throw new Error(`${name}: HybridObject classes must be declared in a .nitro.ts file. ${expectedSyntax}`)
  }
  if (!declaration.isAmbient()) {
    throw new Error(`${name}: HybridObject classes must be ambient. ${expectedSyntax}`)
  }
  if (!declaration.hasExportKeyword() || declaration.isDefaultExport()) {
    throw new Error(`${name}: HybridObject classes must be named exports. ${expectedSyntax}`)
  }
  const constructors = declaration.getConstructors()
  if (constructors.length > 1) {
    throw new Error(
      `${name}: Constructor overloads are not supported. Declare a single public constructor to enable JavaScript construction, or omit the constructor for objects created natively.`
    )
  }
  const constructorDeclaration = constructors[0]
  if (view) {
    if (language === 'c++') {
      throw new Error(`${name}: HybridViews require a Swift or Kotlin view implementation.`)
    }
    if (options.implementation == null) {
      throw new Error(`${name}: HybridViews require a concrete native implementation.`)
    }
    if (constructorDeclaration?.getScope() === Scope.Public) {
      throw new Error(`${name}: React Native creates HybridViews. Omit the constructor or declare it protected.`)
    }
  }
  if (constructorDeclaration?.getScope() === Scope.Public) {
    if (options.implementation == null) {
      throw new Error(
        `${name}: A public constructor requires a concrete implementation on ${platform}. Specs with \`allowMultipleImplementations: true\` must be created through another HybridObject's factory methods.`
      )
    }
    if (declaration.isAbstract()) {
      throw new Error(`${name}: Abstract HybridObject classes cannot be constructed from JavaScript. Use a protected constructor.`)
    }
    const parameters = constructorDeclaration.getParameters().map((parameter) => new Parameter(parameter, target))
    constructorParameters = parameters
  }
  const staticMethods: StaticMethod[] = []
  const staticProperties: StaticProperty[] = []
  for (const member of declaration.getStaticMembers()) {
    if (!Node.isMethodDeclaration(member) && !Node.isPropertyDeclaration(member)) {
      throw new Error(`${name}.${member.getName()}: Static accessors are not supported. Declare a static property instead.`)
    }
    const scope = member.getScope()
    const isPrivate = Node.isPrivateIdentifier(member.getNameNode())
    if (scope !== Scope.Public || isPrivate) {
      throw new Error(`${name}.${member.getName()}: HybridObject members must be public.`)
    }
    if (options.implementation == null) {
      throw new Error(
        `${name}.${member.getName()}: Static members require a concrete implementation on ${platform}. Move static members to a HybridObject with an \`implementation\`.`
      )
    }
    if (Node.isMethodDeclaration(member)) {
      staticMethods.push(new StaticMethod(member, target))
    } else if (Node.isPropertyDeclaration(member)) {
      const memberType = member.getType()
      const isOptional = member.getSymbolOrThrow().isOptional() || memberType.getUnionTypes().some((unionType) => unionType.isUndefined())
      const propType = createType(target, memberType, isOptional, member.getTypeNode())
      staticProperties.push(new StaticProperty(member.getSymbolOrThrow().getName(), propType, member.isReadonly()))
    }
  }
  const allowMultipleImplementations = options.allowMultipleImplementations === true

  const properties: Property[] = []
  const methods: InstanceMethod[] = []
  for (const member of declaration.getInstanceMembers()) {
    const scope = member.getScope()
    const isPrivate = Node.isPrivateIdentifier(member.getNameNode())
    if (scope !== Scope.Public || isPrivate) {
      throw new Error(`${name}.${member.getName()}: HybridObject members must be public.`)
    }
    const memberSymbol = member.getSymbolOrThrow()
    const memberName = memberSymbol.getName()
    if (Node.isPropertyDeclaration(member)) {
      const memberType = member.getType()
      const isOptional = memberSymbol.isOptional() || memberType.getUnionTypes().some((unionType) => unionType.isUndefined())
      const propType = createType(target, memberType, isOptional, member.getTypeNode())
      properties.push(new Property(memberName, propType, member.isReadonly()))
    } else if (Node.isMethodDeclaration(member)) {
      methods.push(new InstanceMethod(member, target))
    } else {
      throw new Error(`${name}: Property "${memberName}" is neither a property, nor a method!`)
    }
  }

  const bases = getDirectBaseTypes(type)
    .filter((t) => isSomeHybridObject(t) && !isHybridViewBaseClass(t))
    .map((baseType) => {
      const baseOptions = getHybridObjectPlatformsForType(baseType)[platform]
      if (baseOptions == null) {
        throw new Error(`${name}: Base ${baseType.getText()} does not support ${platform}.`)
      }
      const base = getHybridObjectSpec(baseType, platform, baseOptions, target)
      if (!base.allowInheritance) {
        throw new Error(
          `${name}: Cannot extend ${base.name} on ${platform}. Use \`allowMultipleImplementations: true\` and \`allowInheritance: true\` on the base class to make it inheritable.`
        )
      }
      if (base.language !== language) {
        throw new Error(`${name}: Base ${base.name} uses ${base.language} on ${platform}, but this spec uses ${language}.`)
      }
      return base
    })

  let constructor: Constructor | undefined
  if (constructorParameters != null) {
    const constructedType = new HybridObjectType(
      name,
      platforms,
      bases.map((base) => new HybridObjectType(base)),
      config
    )
    constructor = new Constructor(getHybridObjectName(name).HybridTSpec, constructedType, constructorParameters)
  }

  const spec: HybridObjectSpec = {
    ...options,
    allowMultipleImplementations: allowMultipleImplementations,
    allowInheritance: options.allowInheritance === true,
    name: name,
    platforms: platforms,
    isHybridView: view,
    properties: properties,
    methods: methods,
    constructor: constructor,
    staticMethods: staticMethods,
    staticProperties: staticProperties,
    baseTypes: bases,
    config: config,
  }

  const accessorNames = new Set(getPropertyAccessorNames(spec))
  const staticMembers = [...staticMethods, ...staticProperties]
  for (const member of staticMembers) {
    if (type.getProperty(member.name) != null || accessorNames.has(member.name)) {
      throw new Error(`${name}.${member.name}: Static members cannot share a name with an instance member or its generated accessor.`)
    }
  }
  const staticCallables = [...staticMethods, ...staticProperties.flatMap((property) => property.getStaticMethods())]
  const callableNames = new Set<string>()
  for (const method of staticCallables) {
    if (callableNames.has(method.name)) {
      throw new Error(`${name}.${method.name}: Static methods and generated property accessors must have distinct names.`)
    }
    if (type.getProperty(method.name) != null || accessorNames.has(method.name)) {
      throw new Error(`${name}.${method.name}: Static members cannot share a name with an instance member or its generated accessor.`)
    }
    callableNames.add(method.name)
  }
  switch (spec.language) {
    case 'kotlin': {
      // Kotlin statics forward through `<name>_cxx` on the spec class, next to the JVM
      // methods of its instance members and accessors (e.g. `setEnabled` for `isEnabled`).
      const jvmNames = new Set([...getInstanceMethodNames(spec), ...getJvmAccessorNames(spec)])
      for (const method of staticCallables) {
        if (jvmNames.has(method.name) || jvmNames.has(`${method.name}_cxx`)) {
          throw new Error(
            `${name}.${method.name}: Static members cannot share a JVM name with an instance member or its accessor on ${platform}.`
          )
        }
      }
      break
    }
    case 'swift':
    case 'c++':
      break
  }

  if (spec.constructor != null) {
    const constructorMethodNames = new Set<string>()
    const methodNames = staticCallables.map((method) => method.name)
    switch (spec.language) {
      case 'swift':
        constructorMethodNames.add('constructor')
        methodNames.push(...getInstanceMethodNames(spec))
        break
      case 'c++':
        constructorMethodNames.add('constructor')
        break
      case 'kotlin':
        constructorMethodNames.add('constructor')
        constructorMethodNames.add('constructor_cxx')
        methodNames.push(...getInstanceMethodNames(spec))
        break
    }
    for (const methodName of methodNames) {
      if (constructorMethodNames.has(methodName)) {
        throw new Error(
          `${name}.${methodName}: Method name is reserved for a generated constructor binding on ${platform}. Rename the method or omit the public constructor.`
        )
      }
    }
  }

  for (const member of [...properties, ...methods]) {
    const isOverridingBaseMember = isMemberOverridingFromBase(member.name, spec, language)
    if (isOverridingBaseMember) {
      throw new Error(
        `\`${name}.${member.name}\` is overriding a member of one of it's base classes. ` +
          `This is unsupported, override on the native side instead!`
      )
    }
  }

  return spec
}

function getInstanceMethodNames(spec: HybridObjectSpec): string[] {
  const ownNames = spec.methods.map((method) => method.name)
  const inheritedNames = spec.baseTypes.flatMap(getInstanceMethodNames)
  return [...ownNames, ...inheritedNames]
}

function getPropertyAccessorNames(spec: HybridObjectSpec): string[] {
  const ownNames = spec.properties.flatMap((property) => property.getCppMethods().map((method) => method.name))
  const inheritedNames = spec.baseTypes.flatMap(getPropertyAccessorNames)
  return [...ownNames, ...inheritedNames]
}

function getJvmAccessorNames(spec: HybridObjectSpec): string[] {
  const ownNames = spec.properties.flatMap((property) => {
    const names = [property.getGetterName('jvm')]
    if (!property.isReadonly) names.push(property.getSetterName('jvm'))
    return names
  })
  const inheritedNames = spec.baseTypes.flatMap(getJvmAccessorNames)
  return [...ownNames, ...inheritedNames]
}

function generateCppFiles(spec: HybridObjectSpec, platform: Platform): SourceFile[] {
  const cppFiles = createCppHybridObject(spec, platform)
  return cppFiles
}

function generateSwiftFiles(spec: HybridObjectSpec<'swift'>): SourceFile[] {
  // Swift owns its spec and the private C++ bridge that registers Swift signatures.
  const swiftFiles = createSwiftHybridObject(spec)
  return swiftFiles
}

function generateKotlinFiles(spec: HybridObjectSpec<'kotlin'>): SourceFile[] {
  return createKotlinHybridObject(spec)
}
