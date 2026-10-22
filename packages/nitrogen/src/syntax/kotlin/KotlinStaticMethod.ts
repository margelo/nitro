import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { StaticMethod } from '../StaticMethod.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import {
  createCppJniCallBody,
  createKotlinBridgeBody,
  getKotlinImplementation,
  prepareKotlinMethod,
  type KotlinMethodBridge,
  type KotlinMethodInfo,
} from './KotlinMethodHelpers.js'
import type { KotlinType } from './types/KotlinType.js'

interface KotlinStaticMethodOptions {
  spec: HybridObjectSpec<'kotlin'>
  method: StaticMethod
}

/**
 * The companion bridge C++ calls through JNI.
 * It calls the static method on the Kotlin implementation's companion object.
 */
export class KotlinStaticMethod extends StaticMethod {
  override readonly returnType: KotlinType
  private readonly nativeMethod: StaticMethod
  private readonly implementationClassName: string
  private readonly jniClass: string
  private readonly callable: KotlinMethodInfo

  constructor({ spec, method }: KotlinStaticMethodOptions) {
    const callable = prepareKotlinMethod(method)
    const parameters = callable.parameters.map((parameter) => parameter.kotlin)
    super(`${method.name}_cxx`, callable.returnType, parameters, {
      access: 'private',
      doNotStrip: true,
      generated: true,
    })
    this.returnType = callable.returnType
    this.nativeMethod = method
    this.implementationClassName = getKotlinImplementation(spec).className
    const { JHybridTSpec } = getHybridObjectName(spec.name)
    this.jniClass = `${JHybridTSpec}::JavaPart::javaClassStatic()`
    this.callable = callable
  }

  createBridge(): KotlinMethodBridge {
    const nativeMethod = this.nativeMethod
    const cppParameters = this.callable.parameters.map((parameter) => parameter.cpp)
    const cppMethod = new StaticMethod(nativeMethod.name, this.callable.cppReturnType, cppParameters, { generated: true })
    const cppBody = createCppJniCallBody({
      callable: this.callable,
      jvmName: this.name,
      jniMethodLookup: `${this.jniClass}->getStaticMethod`,
      jniReceiver: this.jniClass,
    })
    const kotlinBody = createKotlinBridgeBody({
      callable: this.callable,
      getKotlinInvocation: (args) => `${this.implementationClassName}.${nativeMethod.name}(${args.join(', ')})`,
    })
    return {
      kotlinMethods: [{ method: this, body: kotlinBody }],
      cppMethods: [{ method: cppMethod, body: cppBody }],
    }
  }

  /** The name JavaScript calls this method by. */
  get jsName(): string {
    return this.nativeMethod.name
  }

  /**
   * Registers the C++ method on the JavaScript class, from the helper `cppClassName`.
   * `directFactory` names a generated direct host function factory, see `DirectCalls.ts`.
   */
  getCppRegistration(cppClassName: string, directFactory?: string): string {
    const name = this.nativeMethod.name
    if (directFactory != null) {
      return `clazz.registerStaticHybridMethod("${name}", &${cppClassName}::${name}, &${directFactory});`
    }
    return `
clazz.registerStaticHybridMethod("${name}", &${cppClassName}::${name});
`.trim()
  }
}
