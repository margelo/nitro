import { Node, Type } from 'ts-morph'
import type { SourceFile } from './syntax/SourceFile.js'
import { createCppHybridObject } from './syntax/c++/CppHybridObject.js'
import {
  extendsHybridObject,
  isHybridView,
  isAnyHybridSubclass,
  isDirectlyHybridObject,
  type Language,
  isHybridViewProps,
  isHybridViewMethods,
} from './getPlatformSpecs.js'
import type { HybridObjectSpec } from './syntax/HybridObjectSpec.js'
import { Property } from './syntax/Property.js'
import { Method } from './syntax/Method.js'
import { createSwiftHybridObject } from './syntax/swift/SwiftHybridObject.js'
import { createKotlinHybridObject } from './syntax/kotlin/KotlinHybridObject.js'
import { createType } from './syntax/createType.js'
import { Parameter } from './syntax/Parameter.js'
import { getBaseTypes, getHybridObjectNitroModuleConfig } from './utils.js'
import { NitroConfig } from './config/NitroConfig.js'
import { isMemberOverridingFromBase } from './syntax/isMemberOverridingFromBase.js'

/**
 * The name of the marker prop that opts a Hybrid View into rendering React children.
 *
 * It never becomes a native prop - React's renderer mounts and unmounts the
 * child views directly, so it doesn't cross the JS <-> native prop bridge.
 */
const CHILDREN_PROP_NAME = 'children'
/**
 * The type {@linkcode CHILDREN_PROP_NAME} has to be declared as.
 */
const CHILDREN_PROP_TYPE = 'HybridViewChildren'

/**
 * Whether the given Hybrid View props type declares a `children` marker prop.
 *
 * Nitrogen cannot map an arbitrary type to a native prop here (the prop only
 * exists in TypeScript), so anything but `HybridViewChildren` is rejected right
 * away instead of failing later with a confusing "unsupported type" error.
 */
function supportsChildren(viewName: string, props: Type): boolean {
  const children = props.getProperty(CHILDREN_PROP_NAME)
  if (children == null) {
    return false
  }
  const declaration = children.getDeclarations()[0]
  if (declaration == null) {
    throw new Error(
      `${viewName}: Property "${CHILDREN_PROP_NAME}" does not have a type declaration!`
    )
  }
  // `children?: HybridViewChildren` is a union with `undefined`, so check each type in it.
  const type = children.getTypeAtLocation(declaration)
  const types = type.isUnion() ? type.getUnionTypes() : [type]
  const isMarker = types.some(
    (t) => t.getSymbol()?.getName() === CHILDREN_PROP_TYPE
  )
  if (!isMarker) {
    throw new Error(
      `${viewName}: The "${CHILDREN_PROP_NAME}" prop is reserved - it marks a Nitro View as ` +
        `rendering React children, so it has to be declared as ` +
        `\`${CHILDREN_PROP_NAME}?: ${CHILDREN_PROP_TYPE}\` (got \`${type.getText()}\`).`
    )
  }
  return true
}

export function generatePlatformFiles(
  interfaceType: Type,
  language: Language
): SourceFile[] {
  const spec = getHybridObjectSpec(interfaceType, language)

  // TODO: We currently just call this so the HybridObject itself is a "known type".
  // This causes the Swift Umbrella header to properly forward-declare it.
  // Without this, only Hybrid Objects that are actually used in public APIs will be forward-declared.
  createType(language, interfaceType, false)

  switch (language) {
    case 'c++':
      return generateCppFiles(spec)
    case 'swift':
      return generateSwiftFiles(spec)
    case 'kotlin':
      return generateKotlinFiles(spec)
    default:
      throw new Error(`Language "${language}" is not supported!`)
  }
}

function getHybridObjectSpec(
  type: Type,
  language: Language,
  stripChildrenProp = false
): HybridObjectSpec {
  const config = getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current

  if (isHybridView(type)) {
    const symbol = type.getAliasSymbolOrThrow()
    const name = symbol.getEscapedName()

    // It's a Hybrid View - the `Props & Methods` types are just intersected together.
    const unions = type.getIntersectionTypes()
    const props = unions.find((t) => isHybridViewProps(t))
    const methods = unions.find((t) => isHybridViewMethods(t))
    if (props == null)
      throw new Error(
        `Props cannot be null! ${name}<...> (HybridView) requires type arguments.`
      )
    const hasChildren = supportsChildren(name, props)
    const propsSpec = getHybridObjectSpec(props, language, hasChildren)
    const methodsSpec =
      methods != null ? getHybridObjectSpec(methods, language) : undefined

    return {
      baseTypes: [],
      isHybridView: true,
      supportsChildren: hasChildren,
      language: language,
      methods: methodsSpec?.methods ?? [],
      properties: propsSpec.properties,
      name: name,
      config: config,
    }
  }

  const symbol = type.getSymbolOrThrow()
  const name = symbol.getEscapedName()

  const properties: Property[] = []
  const methods: Method[] = []
  for (const prop of type.getProperties()) {
    if (stripChildrenProp && prop.getName() === CHILDREN_PROP_NAME) {
      // `children` only marks the View as rendering React children - skip it
      // before `createType(..)` ever sees it, it has no native representation.
      continue
    }

    const declarations = prop.getDeclarations()
    if (declarations.length > 1) {
      throw new Error(
        `${name}: Function overloading is not supported! (In "${prop.getName()}")`
      )
    }
    let declaration = declarations[0]
    if (declaration == null) {
      throw new Error(
        `${name}: Property "${prop.getName()}" does not have a type declaration!`
      )
    }

    const parent = declaration.getParentOrThrow().getType()

    if (parent === type) {
      // it's an own property. declared literally here. fine.
    } else if (
      extendsHybridObject(parent, true) ||
      isDirectlyHybridObject(parent)
    ) {
      // it's coming from a base class that is already a HybridObject. We can grab this via inheritance.
      // don't generate this property natively.
      continue
    } else {
      // it's coming from any TypeScript type that is not a HybridObject.
      // Maybe just a literal interface, then we copy over the props.
    }

    if (Node.isPropertySignature(declaration)) {
      const t = declaration.getType()
      const isOptional =
        prop.isOptional() || t.getUnionTypes().some((u) => u.isUndefined())
      const propType = createType(
        language,
        t,
        isOptional,
        declaration.getTypeNode()
      )
      properties.push(
        new Property(prop.getName(), propType, declaration.isReadonly())
      )
    } else if (Node.isMethodSignature(declaration)) {
      const returnType = declaration.getReturnType()
      const isOptional = returnType.getUnionTypes().some((t) => t.isUndefined())
      const methodReturnType = createType(
        language,
        returnType,
        isOptional,
        declaration.getReturnTypeNode()
      )
      const methodParameters = declaration
        .getParameters()
        .map((p) => new Parameter(p, language))
      methods.push(
        new Method(prop.getName(), methodReturnType, methodParameters)
      )
    } else {
      throw new Error(
        `${name}: Property "${prop.getName()}" is neither a property, nor a method!`
      )
    }
  }

  const bases = getBaseTypes(type)
    .filter((t) => isAnyHybridSubclass(t))
    .map((t) => getHybridObjectSpec(t, language))

  const spec: HybridObjectSpec = {
    language: language,
    name: name,
    properties: properties,
    methods: methods,
    baseTypes: bases,
    isHybridView: isHybridView(type),
    supportsChildren: false,
    config: config,
  }

  for (const member of [...properties, ...methods]) {
    const isOverridingBaseMember = isMemberOverridingFromBase(
      member.name,
      spec,
      language
    )
    if (isOverridingBaseMember) {
      throw new Error(
        `\`${name}.${member.name}\` is overriding a member of one of it's base classes. ` +
          `This is unsupported, override on the native side instead!`
      )
    }
  }

  return spec
}

function generateCppFiles(spec: HybridObjectSpec): SourceFile[] {
  const cppFiles = createCppHybridObject(spec)
  return cppFiles
}

function generateSwiftFiles(spec: HybridObjectSpec): SourceFile[] {
  // 1. Always generate a C++ spec for the shared layer and type declarations (enums, interfaces, ...)
  const cppFiles = generateCppFiles(spec)
  // 2. Generate Swift specific files and potentially a C++ binding layer
  const swiftFiles = createSwiftHybridObject(spec)
  return [...cppFiles, ...swiftFiles]
}

function generateKotlinFiles(spec: HybridObjectSpec): SourceFile[] {
  // 1. Always generate a C++ spec for the shared layer and type declarations (enums, interfaces, ...)
  const cppFiles = generateCppFiles(spec)
  // 2. Generate Kotlin specific files and potentially a C++ binding layer
  const kotlinFiles = createKotlinHybridObject(spec)
  return [...cppFiles, ...kotlinFiles]
}
