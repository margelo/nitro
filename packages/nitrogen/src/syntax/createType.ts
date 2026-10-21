import { Node, ts, Type as TSMorphType, type Project, type Signature } from 'ts-morph'
import { SourceError, withSourceLocation } from '../SourceError.js'
import type { Type } from './types/Type.js'
import { BooleanType } from './types/BooleanType.js'
import { NumberType } from './types/NumberType.js'
import { StringType } from './types/StringType.js'
import { Int64Type } from './types/Int64Type.js'
import { VoidType } from './types/VoidType.js'
import { ArrayType } from './types/ArrayType.js'
import { CallbackType } from './types/CallbackType.js'
import { PromiseType } from './types/PromiseType.js'
import { RecordType } from './types/RecordType.js'
import { ArrayBufferType } from './types/ArrayBufferType.js'
import { EnumType } from './types/EnumType.js'
import { HybridObjectType } from './types/HybridObjectType.js'
import { StructType } from './types/StructType.js'
import { OptionalType } from './types/OptionalType.js'
import { NamedWrappingType } from './types/NamedWrappingType.js'
import { getInterfaceProperties } from './getInterfaceProperties.js'
import { VariantType } from './types/VariantType.js'
import { AnyJSONType } from './types/AnyJSONType.js'
import { TupleType } from './types/TupleType.js'
import {
  isSomeHybridObject,
  isHybridViewBaseClass,
  isDirectlyAnyHybridObject,
  getHybridObjectPlatformsForType,
  type Language,
} from '../getPlatformSpecs.js'
import { AnyHybridObjectType } from './types/AnyHybridObjectType.js'
import { ErrorType } from './types/ErrorType.js'
import { getDirectBaseTypes, getHybridObjectNitroModuleConfig } from '../utils.js'
import { NitroConfig } from '../config/NitroConfig.js'
import { CustomType } from './types/CustomType.js'
import { isArrayBuffer, isCustomType, isError, isInlineCallback, isAnyJSON, isPromise, isRecord, isInt64, isUInt64 } from './isCoreType.js'
import { getCustomTypeConfig } from './getCustomTypeConfig.js'
import { compareLooselyness } from './helpers.js'
import { NullType } from './types/NullType.js'
import { UInt64Type } from './types/UInt64Type.js'
import { ForeignHybridObjectType } from './c++/ForeignHybridObjectType.js'
import { getHybridObjectSpec } from '../createPlatformSpec.js'
import type { Platform } from '../getPlatformSpecs.js'

function getHybridObjectName(type: TSMorphType): string {
  const symbol = type.getSymbol()
  if (symbol == null) {
    throw new Error(`Cannot get name of \`${type.getText()}\` - symbol not found!`)
  }
  return symbol.getEscapedName()
}

/** Declaration metadata does not parse member APIs or request adapters. */
function getHybridObjectReference(type: TSMorphType): HybridObjectType {
  const bases = getDirectBaseTypes(type)
    .filter((base) => isSomeHybridObject(base) && !isHybridViewBaseClass(base))
    .map(getHybridObjectReference)
  return new HybridObjectType(
    getHybridObjectName(type),
    getHybridObjectPlatformsForType(type),
    bases,
    getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current
  )
}

function getCallbackCallSignature(callback: TSMorphType): Signature {
  const callSignatures = callback.getCallSignatures()
  const callSignature = callSignatures[0]
  if (callSignatures.length !== 1 || callSignature == null) {
    throw new Error(`Callback overloads are not supported in Nitrogen! (in ${callback.getText()})`)
  }
  return callSignature
}

/**
 * Whether the given type is optional (`T | undefined`) or not.
 *
 * Note that `null` is a separate type in Nitro (`NullType`) - only `undefined`
 * (or a `?`) makes a type optional.
 */
function isOptionalType(type: TSMorphType): boolean {
  return type.getUnionTypes().some((t) => t.isUndefined())
}

function removeDuplicates(types: Type[]): Type[] {
  return types.filter((t1, index, array) => {
    const firstIndexOfType = array.findIndex((t2) => t1.getCode('c++', { context: 'value' }) === t2.getCode('c++', { context: 'value' }))
    return firstIndexOfType === index
  })
}

type Tuple<T, N extends number, R extends unknown[] = []> = R['length'] extends N ? R : Tuple<T, N, [T, ...R]>

type TypeNode = Node<ts.TypeNode>

interface UnionConstituent {
  type: TSMorphType
  typeNode?: TypeNode
}

function getAliasTypeNode(type: TSMorphType): TypeNode | undefined {
  // Removing null can discard the alias of a union containing AnyJSON.
  const symbol = type.getAliasSymbol() ?? type.getNonNullableType().getAliasSymbol()
  const declaration = symbol?.getDeclarations()[0]
  if (declaration != null && Node.isTypeAliasDeclaration(declaration) && declaration.getTypeParameters().length === 0) {
    return declaration.getTypeNode()
  }
  return undefined
}

function getUnionTypeNodes(type: TSMorphType, typeNode?: TypeNode): TypeNode[] | undefined {
  if (typeNode != null && Node.isUnionTypeNode(typeNode)) {
    return typeNode.getTypeNodes()
  }

  const aliasTypeNode = getAliasTypeNode(type)
  if (aliasTypeNode != null && Node.isUnionTypeNode(aliasTypeNode)) {
    return aliasTypeNode.getTypeNodes()
  }

  return undefined
}

function getUnionConstituents(type: TSMorphType, typeNode?: TypeNode): UnionConstituent[] {
  const typeNodes = getUnionTypeNodes(type, typeNode)
  if (typeNodes != null) {
    return typeNodes.map((node) => ({
      type: node.getType(),
      typeNode: node,
    }))
  }

  return type.getUnionTypes().map((unionType) => ({ type: unionType }))
}

function getArguments<N extends number>(type: TSMorphType, typename: string, count: N): Tuple<TSMorphType<ts.Type>, N> {
  const typeArguments = type.getTypeArguments()
  if (typeArguments.length === count) {
    return typeArguments as Tuple<TSMorphType<ts.Type>, N>
  }

  const aliasTypeArguments = type.getAliasTypeArguments()
  if (aliasTypeArguments.length === count) {
    return aliasTypeArguments as Tuple<TSMorphType<ts.Type>, N>
  }

  throw new Error(
    `Type ${type.getText()} looks like a ${typename}, but has ${typeArguments.length} or ${aliasTypeArguments.length} type arguments instead of ${count}!`
  )
}

export interface CreateTypeOptions {
  /** Whether the type belongs to a method, static method or constructor parameter. */
  isParameter?: boolean
}

export interface TypeParsingTarget {
  readonly language: Language
  readonly platform: Platform
  /** Definitions already being parsed; their recursive references need no files. */
  readonly foreignAncestors?: readonly HybridObjectType[]
}

export function createNamedType(
  target: TypeParsingTarget,
  name: string,
  type: TSMorphType,
  isOptional: boolean,
  typeNode?: TypeNode,
  options: CreateTypeOptions = {}
) {
  if (name.startsWith('__')) {
    throw new Error(`Name cannot start with two underscores (__) as this is reserved syntax for Nitrogen! (In ${type.getText()})`)
  }
  return new NamedWrappingType(name, createType(target, type, isOptional, typeNode, options))
}

export function createVoidType(): Type {
  return new VoidType()
}

// Parsed types belong to the TypeScript project that resolved their declarations.
// Releasing the project also releases its cache, without resetting global state.
type TypeCache = Record<Language, Map<string, Type>>
const projectTypeCaches = new WeakMap<Project, TypeCache>()

function getTypeCache(type: TSMorphType, language: Language): Map<string, Type> | undefined {
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  const project = symbol?.getDeclarations()[0]?.getProject()
  if (project == null) return undefined

  let cache = projectTypeCaches.get(project)
  if (cache == null) {
    cache = {
      'c++': new Map(),
      'swift': new Map(),
      'kotlin': new Map(),
    }
    projectTypeCaches.set(project, cache)
  }
  return cache[language]
}

function getTypeId(type: TSMorphType, isOptional: boolean): string {
  const config = getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  let key = `${config.getCxxNamespace('c++')}:${type.getText()}`
  if (symbol != null) key += '_' + symbol.getFullyQualifiedName()
  if (isOptional) key += '?'
  return key
}

/**
 * Create a new type (or return it from cache if it is already known)
 */
export function createType(
  target: TypeParsingTarget,
  type: TSMorphType,
  isOptional: boolean,
  typeNode?: TypeNode,
  { isParameter = false }: CreateTypeOptions = {}
): Type {
  if (isInlineCallback(type) && !isParameter) {
    // Native code cannot keep a borrowed callback beyond the call.
    const typeName = type.getText(undefined, ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope)
    throw new Error(`Inline callbacks (${typeName}) can only be the type of a required method, static method or constructor parameter!`)
  }
  const { language, platform, foreignAncestors = [] } = target
  // An ancestor reference has no definition files, so it must not enter the
  // cache used by complete references outside this declaration.
  let cache: Map<string, Type> | undefined
  if (foreignAncestors.length === 0) cache = getTypeCache(type, language)
  const key = `${platform}:${getTypeId(type, isOptional)}`
  const known = cache?.get(key)
  if (known != null) {
    if (isOptional === known instanceof OptionalType) {
      return known
    }
  }

  const get = () => {
    if (isOptional) {
      const wrapping = createType(target, type, false, typeNode)
      return new OptionalType(wrapping)
    }

    if (type.isNull()) {
      return new NullType()
    } else if (type.isBoolean() || type.isBooleanLiteral()) {
      return new BooleanType()
    } else if (type.isNumber() || type.isNumberLiteral()) {
      if (type.isEnumLiteral()) {
        // An enum is just a number, that's why it's a number literal.
        // Get the base of the literal, which would be our enum's definition.
        const baseType = type.getBaseTypeOfLiteralType()
        if (!baseType.isEnum()) {
          // The base of the literal is not the enum definition, we need to throw.
          throw new Error(
            `The enum "${type.getLiteralValue()}" (${type.getText()}) is either a single-value-enum, or an enum-literal. Use a separately defined enum with at least 2 cases instead!`
          )
        }
        // Call createType(...) now with the enum type.
        return createType(target, baseType, isOptional, typeNode)
      }
      return new NumberType()
    } else if (type.isString()) {
      return new StringType()
    } else if (isInt64(type)) {
      return new Int64Type()
    } else if (isUInt64(type)) {
      return new UInt64Type()
    } else if (type.isVoid()) {
      return new VoidType()
    } else if (type.isArray()) {
      const arrayElementType = type.getArrayElementTypeOrThrow()
      const elementType = createType(target, arrayElementType, isOptionalType(arrayElementType), undefined)
      return new ArrayType(elementType)
    } else if (type.isTuple()) {
      const itemTypes = type.getTupleElements().map((t) => createType(target, t, isOptionalType(t), undefined))
      return new TupleType(itemTypes)
    } else if (type.getCallSignatures().length > 0) {
      // It's a callback!
      const callSignature = getCallbackCallSignature(type)
      const callbackReturnType = callSignature.getReturnType()
      const returnType = createType(target, callbackReturnType, isOptionalType(callbackReturnType), undefined)
      const parameters = callSignature.getParameters().map((p) => {
        const declaration = p.getValueDeclarationOrThrow()
        if (Node.isParameterDeclaration(declaration) && declaration.isRestParameter()) {
          throw new SourceError(declaration, 'Rest parameters are not supported by Nitrogen. Declare a single array parameter instead.')
        }
        const parameterType = p.getTypeAtLocation(declaration)
        const isParameterOptional = isOptionalType(parameterType) || p.isOptional()
        return withSourceLocation(declaration, () => createNamedType(target, p.getName(), parameterType, isParameterOptional, undefined))
      })
      return new CallbackType(returnType, parameters, isInlineCallback(type))
    } else if (isPromise(type)) {
      // It's a Promise!
      const [promiseResolvingType] = getArguments(type, 'Promise', 1)
      const resolvingType = createType(target, promiseResolvingType, isOptionalType(promiseResolvingType), undefined)
      return new PromiseType(resolvingType)
    } else if (isRecord(type)) {
      // Record<K, V> -> unordered_map<K, V>
      const [keyTypeT, valueTypeT] = getArguments(type, 'Record', 2)
      const keyType = createType(target, keyTypeT, false, undefined)
      const valueType = createType(target, valueTypeT, isOptionalType(valueTypeT), undefined)
      return new RecordType(keyType, valueType)
    } else if (isArrayBuffer(type)) {
      // ArrayBuffer
      return new ArrayBufferType()
    } else if (isAnyJSON(type)) {
      // AnyJSON
      return new AnyJSONType()
    } else if (isError(type)) {
      // Error
      return new ErrorType()
    } else if (isCustomType(type)) {
      // Custom C++ type (manually written)
      const { name, config } = getCustomTypeConfig(type)
      return new CustomType(name, config)
    } else if (type.isEnum()) {
      // It is an enum. We need to generate a C++ declaration for the enum
      const typename = type.getSymbolOrThrow().getEscapedName()
      const declaration = type.getSymbolOrThrow().getValueDeclarationOrThrow()
      const enumDeclaration = declaration.asKindOrThrow(ts.SyntaxKind.EnumDeclaration)
      return new EnumType(typename, enumDeclaration, getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current)
    } else if (type.isUnion()) {
      // It is some kind of union;
      // - of string literals (then it's an enum)
      // - of type `T | undefined` (then it's just optional `T`)
      // - of different types (then it's a variant `A | B | C`)
      const nonNullTypes = type.getUnionTypes().filter((t) => !t.isNull() && !t.isUndefined() && !t.isVoid())
      const isEnumUnion = nonNullTypes.every((t) => t.isStringLiteral())
      if (isEnumUnion) {
        // It consists only of string literaly - that means it's describing an enum!
        const symbol = type.getNonNullableType().getAliasSymbol()
        if (symbol == null) {
          // If there is no alias, it is an inline union instead of a separate type declaration!
          throw new Error(
            `Inline union types ("${type.getText()}") are not supported by Nitrogen!\n` +
              `Extract the union to a separate type, and re-run nitrogen!`
          )
        }
        const typename = symbol.getEscapedName()
        return new EnumType(typename, type, getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current)
      } else {
        // It consists of different types - that means it's a variant!
        const unionConstituents = getUnionConstituents(type, typeNode)
        let variants = unionConstituents
          // Filter out any undefineds/voids, as those are already treated as `isOptional`.
          .filter(({ type: t }) => !t.isUndefined() && !t.isVoid())
          .map(({ type: t, typeNode: node }) => createType(target, t, false, node))
          .toSorted(compareLooselyness)
        variants = removeDuplicates(variants)

        if (variants.length === 1) {
          // It's just one type with undefined/null variant(s) - so we treat it like a simple optional.
          return variants[0]!
        }

        const name = type.getAliasSymbol()?.getName()
        return new VariantType(variants, name)
      }
    } else if (isDirectlyAnyHybridObject(type)) {
      // It is a HybridObject directly/literally. Base type
      return new AnyHybridObjectType()
    } else if (isSomeHybridObject(type)) {
      // It is another HybridObject being referenced!
      const reference = getHybridObjectReference(type)
      const { hybridObjectName: typename, platforms, sourceConfig } = reference
      if (language !== 'c++') return reference
      const options = platforms[platform]
      if (options == null) {
        throw new Error(
          `HybridObject "${typename}" is not implemented on ${platform} and cannot be referenced from a C++ API on that platform.`
        )
      }
      if (!ForeignHybridObjectType.isRequiredFor(reference)) return reference
      const ancestor = foreignAncestors.find(
        (candidate) =>
          candidate.hybridObjectName === typename && candidate.sourceConfig.getCxxNamespace('c++') === sourceConfig.getCxxNamespace('c++')
      )
      if (ancestor != null) return new ForeignHybridObjectType(reference, platform)
      const nestedTarget: TypeParsingTarget = {
        language: language,
        platform: platform,
        foreignAncestors: [...foreignAncestors, reference],
      }
      const spec = getHybridObjectSpec(type, platform, options, nestedTarget)
      return new ForeignHybridObjectType(reference, platform, spec)
    } else if (type.isInterface()) {
      // It is an `interface T { ... }`, which is a `struct`
      const symbol = type.getAliasSymbol() ?? type.getSymbol()
      if (symbol == null) throw new Error(`Interface "${type.getText()}" does not have a Symbol!`)
      const typename = symbol.getName()
      const properties = getInterfaceProperties(target, type)
      const sourceConfig = getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current
      return new StructType(typename, properties, sourceConfig)
    } else if (type.isObject()) {
      // It is an object. If it has a symbol/name, it is a `type T = ...` declaration, so a `struct`.
      // Otherwise, it is an anonymous/inline object, which cannot be represented in native.
      const symbol = type.getAliasSymbol()
      if (symbol != null) {
        // it has a `type T = ...` declaration
        const typename = symbol.getName()
        const properties = getInterfaceProperties(target, type)
        const sourceConfig = getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current
        return new StructType(typename, properties, sourceConfig)
      } else {
        // It's an anonymous object (`{ ... }`)
        throw new Error(
          `Anonymous objects cannot be represented in C++! Extract "${type.getText()}" to a separate interface/type declaration.`
        )
      }
    } else if (type.isStringLiteral()) {
      throw new Error(
        `String literal ${type.getText()} cannot be represented in C++ because it is ambiguous between a string and a discriminating union enum.`
      )
    } else if (type.isUndefined()) {
      throw new Error(
        `The TypeScript type "undefined" cannot be represented in Nitro.\n` +
          `- If you want to make a type optional, add \`?\` to its name, or make it an union with \`undefined\`.\n` +
          `- If you want a method that returns nothing, use \`void\` instead.\n` +
          `- If you want to represent an explicit absence of a value, use \`null\` instead.`
      )
    } else if (type.isAny()) {
      throw new Error(`The TypeScript type "${type.getText()}" resolved to any - any is not supported in Nitro.`)
    } else if (type.isBigInt()) {
      throw new Error(`Using a bigint without specifying signedness is deprecated! Use \`Int64\` or \`UInt64\` instead.`)
    } else if (type.isLiteral()) {
      throw new Error(`The literal "${type.getLiteralValue()}" cannot be used as a type!`)
    } else {
      if (type.getSymbol() == null) {
        // There is no declaration for it!
        // Could be an invalid import, e.g. an alias
        throw new Error(
          `The TypeScript type "${type.getText()}" cannot be resolved - is it imported properly? ` +
            `Make sure to import it properly using fully specified relative or absolute imports, no aliases.`
        )
      } else {
        // A different error
        throw new Error(`The TypeScript type "${type.getText()}" cannot be represented in C++!`)
      }
    }
  }

  const result = typeNode == null ? get() : withSourceLocation(typeNode, get)
  cache?.set(key, result)
  return result
}
