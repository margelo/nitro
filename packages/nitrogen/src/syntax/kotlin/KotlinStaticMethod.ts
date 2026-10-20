import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { StaticMethod } from '../StaticMethod.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import {
  createCppJniCallBody,
  createKotlinForwarderBody,
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
 * The companion forwarder C++ calls through JNI.
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
    const cppMethod = new StaticMethod(
      nativeMethod.name,
      nativeMethod.returnType,
      nativeMethod.parameters,
      { generated: true }
    )
    const cppBody = createCppJniCallBody({
      callable: this.callable,
      jvmName: this.name,
      jniMethodLookup: `${this.jniClass}->getStaticMethod`,
      jniReceiver: this.jniClass,
    })
    const kotlinBody = createKotlinForwarderBody({
      callable: this.callable,
      getKotlinInvocation: (args) =>
        `${this.implementationClassName}.${nativeMethod.name}(${args.join(', ')})`,
    })
    return {
      kotlinMethods: [{ method: this, body: kotlinBody }],
      cppMethods: [{ method: cppMethod, body: cppBody }],
    }
  }

  /** Registers the C++ method on the JavaScript class, from the helper `cppClassName`. */
  getCppRegistration(cppClassName: string): string {
    const name = this.nativeMethod.name
    return `
clazz.registerStaticHybridMethod("${name}", &${cppClassName}::${name});
`.trim()
  }
}
