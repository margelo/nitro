import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { Method } from '../Method.js'
import { Parameter } from '../Parameter.js'
import type { SourceImport } from '../SourceFile.js'
import { wrapKotlinType } from './wrapKotlinType.js'
import { convertJniValue, getJniCode, type GetKotlinCodeOptions, type KotlinType } from './types/KotlinType.js'
import { indent } from '../../utils.js'
import type { Type } from '../types/Type.js'

export interface KotlinMethodDefinition {
  method: Method
  body: string
}

/** Keep JNI entry names stable when Kotlin value classes would otherwise mangle them. */
export function createKotlinBridgeDefinition({ method, body }: KotlinMethodDefinition): string {
  const definition = method.getDefinition('kotlin', { body: body })
  return `
@JvmName("${method.name}")
${definition}
`.trim()
}

export interface KotlinMethodBridge {
  /** Private Kotlin functions that JNI calls instead of the public members. */
  kotlinMethods: KotlinMethodDefinition[]
  /** C++ methods that call Kotlin through JNI. */
  cppMethods: KotlinMethodDefinition[]
}

interface KotlinMethodParameter {
  native: Parameter
  cpp: Parameter
  kotlin: Parameter
  type: KotlinType
}

/** The JNI representations of a native signature. */
export interface KotlinMethodInfo {
  nativeMethod: Method
  returnType: KotlinType
  cppReturnType: Type
  hasNativeReturn: boolean
  parameters: KotlinMethodParameter[]
  /** Whether JNI needs a private bridge for value conversion or a stable JVM name. */
  needsKotlinBridge: boolean
}

interface PrepareKotlinMethodOptions {
  /** Constructor factories keep their native shared_ptr return for C++ adapters. */
  directReturn?: boolean
}

export function prepareKotlinMethod(nativeMethod: Method, { directReturn = true }: PrepareKotlinMethodOptions = {}): KotlinMethodInfo {
  const returnType = wrapKotlinType(nativeMethod.returnType)
  const cppParameterOptions: GetKotlinCodeOptions = { context: 'parameter', ownership: 'owned' }
  const parameters = nativeMethod.parameters.map((parameter) => {
    const kotlinType = wrapKotlinType(parameter.type)
    return {
      native: parameter,
      cpp: new Parameter(parameter.name, kotlinType, { codeOptions: cppParameterOptions }),
      kotlin: new Parameter(parameter.name, kotlinType),
      type: kotlinType,
    }
  })
  const needsKotlinConversion = returnType.needsKotlinConversion || parameters.some((parameter) => parameter.type.needsKotlinConversion)
  const requiresKotlinJvmName =
    returnType.requiresKotlinJvmName === true || parameters.some((parameter) => parameter.type.requiresKotlinJvmName === true)
  return {
    nativeMethod: nativeMethod,
    returnType: returnType,
    cppReturnType: directReturn ? returnType : nativeMethod.returnType,
    hasNativeReturn: !directReturn,
    parameters: parameters,
    needsKotlinBridge: needsKotlinConversion || requiresKotlinJvmName,
  }
}

interface KotlinBridgeBodyOptions {
  callable: KotlinMethodInfo
  getKotlinInvocation: (args: string[]) => string
}

/** Kotlin bridges convert JNI values to the public API and back. */
export function createKotlinBridgeBody({ callable, getKotlinInvocation }: KotlinBridgeBodyOptions): string {
  const kotlinArguments = callable.parameters.map((parameter) =>
    parameter.type.convert(parameter.native.type.escapedName, {
      from: 'c++',
      to: 'kotlin',
      in: 'kotlin',
    })
  )
  const kotlinInvocation = getKotlinInvocation(kotlinArguments)
  if (callable.nativeMethod.returnType.kind === 'void') {
    return `
${kotlinInvocation}
`.trim()
  }
  const kotlinResult = callable.returnType.convert('__result', {
    from: 'kotlin',
    to: 'c++',
    in: 'kotlin',
  })
  return `
val __result = ${kotlinInvocation}
return ${kotlinResult}
`.trim()
}

interface CppJniCallBodyOptions {
  callable: KotlinMethodInfo
  /** The JVM method C++ calls, e.g. `addNumbers_cxx`. */
  jvmName: string
  /** Looks up the fbjni method, e.g. `CxxPart::getClass()->getMethod`. */
  jniMethodLookup: string
  /** The Java instance, or the class for static methods. */
  jniReceiver: string
  /** The lookup class passed to fbjni's nonvirtual invocation. */
  jniDeclaringClass?: string
}

/**
 * Calls Kotlin through a cached fbjni method, converting values between C++ and JNI.
 * The caller must already be attached to the JVM.
 * Generated locals use the reserved `__` prefix, so they cannot shadow parameters.
 */
export function createCppJniCallBody({
  callable,
  jvmName,
  jniMethodLookup,
  jniReceiver,
  jniDeclaringClass,
}: CppJniCallBodyOptions): string {
  const jniReturnType = getJniCode(callable.returnType, {
    context: 'return',
  })
  const jniParameterTypes = callable.parameters.map((parameter) => {
    const type = getJniCode(parameter.type, { context: 'parameter' })
    return `${type} /* ${parameter.native.name} */`
  })
  const jniSignature = `${jniReturnType}(${jniParameterTypes.join(', ')})`
  const jniArguments = [jniReceiver]
  if (jniDeclaringClass != null) {
    jniArguments.push(jniDeclaringClass)
  }
  jniArguments.push(
    ...callable.parameters.map((parameter) => {
      return convertJniValue(parameter.type, parameter.native.type.escapedName, 'to-jni')
    })
  )
  if (callable.nativeMethod.returnType.kind === 'void') {
    return `
static const auto __method = ${jniMethodLookup}<${jniSignature}>("${jvmName}");
__method(${jniArguments.join(', ')});
`.trim()
  }
  let cppResult: string
  if (callable.hasNativeReturn) {
    cppResult = callable.returnType.convert('__result', {
      from: 'kotlin',
      to: 'c++',
      in: 'c++',
    })
  } else {
    cppResult = convertJniValue(callable.returnType, '__result', 'from-jni')
  }
  return `
static const auto __method = ${jniMethodLookup}<${jniSignature}>("${jvmName}");
auto __result = __method(${jniArguments.join(', ')});
return ${indent(cppResult, '')};
`.trim()
}

interface KotlinImplementation {
  className: string
  kotlinImport: SourceImport<'kotlin'>
}

/** The Kotlin class implementing the spec, which constructors and static methods call. */
export function getKotlinImplementation(spec: HybridObjectSpec<'kotlin'>): KotlinImplementation {
  const implementation = spec.implementation
  if (implementation == null) {
    throw new Error(`${spec.name}: Constructors and static methods require a Kotlin implementation.`)
  }
  // The package is already resolved within the spec's Android namespace.
  const qualifiedName = [...implementation.package, implementation.className].join('.')
  return {
    className: implementation.className,
    kotlinImport: { language: 'kotlin', name: qualifiedName },
  }
}
