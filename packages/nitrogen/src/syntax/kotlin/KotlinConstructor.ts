import { Constructor } from '../Constructor.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { StaticMethod } from '../StaticMethod.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import {
  createCppJniCallBody,
  createKotlinForwarderBody,
  getKotlinImplementation,
  prepareKotlinMethod,
  type KotlinMethodBridge,
  type KotlinMethodInfo,
} from './KotlinMethodHelpers.js'
import type { KotlinType } from './types/KotlinType.js'

interface KotlinConstructorOptions {
  spec: HybridObjectSpec<'kotlin'>
  constructor: Constructor
}

/**
 * Constructs the Kotlin implementation for JavaScript.
 * C++ calls a companion factory through JNI, which calls the Kotlin constructor.
 */
export class KotlinConstructor extends Constructor {
  override readonly returnType: KotlinType
  private readonly nativeFactory: StaticMethod
  private readonly implementationClassName: string
  private readonly jniClass: string
  private readonly callable: KotlinMethodInfo

  constructor({ spec, constructor }: KotlinConstructorOptions) {
    const returnType = new HybridObjectType(spec)
    const nativeFactory = constructor.toStaticMethod(returnType)
    const callable = prepareKotlinMethod(nativeFactory)
    const parameters = callable.parameters.map((parameter) => parameter.kotlin)
    super(constructor.name, callable.returnType, parameters, {
      generated: true,
    })
    this.returnType = callable.returnType
    this.nativeFactory = nativeFactory
    this.implementationClassName = getKotlinImplementation(spec).className
    const { JHybridTSpec } = getHybridObjectName(spec.name)
    this.jniClass = `${JHybridTSpec}::JavaPart::javaClassStatic()`
    this.callable = callable
  }

  createBridge(): KotlinMethodBridge {
    // The C++ bridge calls static factories rather than Kotlin constructors.
    const nativeFactory = this.nativeFactory
    const kotlinFactory = new StaticMethod(
      `${nativeFactory.name}_cxx`,
      this.returnType,
      this.parameters,
      { access: 'private', doNotStrip: true, generated: true }
    )
    const cppBody = createCppJniCallBody({
      callable: this.callable,
      jvmName: kotlinFactory.name,
      jniMethodLookup: `${this.jniClass}->getStaticMethod`,
      jniReceiver: this.jniClass,
    })
    const kotlinBody = createKotlinForwarderBody({
      callable: this.callable,
      getKotlinInvocation: (args) =>
        `${this.implementationClassName}(${args.join(', ')})`,
    })
    return {
      kotlinMethods: [{ method: kotlinFactory, body: kotlinBody }],
      cppMethods: [{ method: nativeFactory, body: cppBody }],
    }
  }

  /** Registers the C++ factory as the JavaScript constructor, from the helper `cppClassName`. */
  getCppRegistration(cppClassName: string): string {
    return `
clazz.registerHybridConstructor(&${cppClassName}::${this.nativeFactory.name});
`.trim()
  }
}
