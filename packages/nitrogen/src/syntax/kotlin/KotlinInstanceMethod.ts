import { InstanceMethod } from '../InstanceMethod.js'
import { Parameter } from '../Parameter.js'
import type { Property } from '../Property.js'
import {
  createCppJniCallBody,
  createKotlinBridgeBody,
  prepareKotlinMethod,
  type KotlinMethodBridge,
  type KotlinMethodDefinition,
  type KotlinMethodInfo,
} from './KotlinMethodHelpers.js'
import type { KotlinType } from './types/KotlinType.js'

interface KotlinAccessor {
  kind: 'getter' | 'setter'
  property: Property
}

interface KotlinInstanceMethodOptions {
  method: InstanceMethod
  accessor?: KotlinAccessor
}

interface KotlinInstanceBridgeOptions {
  nonvirtual?: boolean
}

/**
 * The Kotlin member that C++ calls through JNI.
 * If values need conversion, this is a private `_cxx` bridge;
 * otherwise JNI calls the public abstract member directly.
 */
export class KotlinInstanceMethod extends InstanceMethod {
  override readonly returnType: KotlinType
  private readonly nativeMethod: InstanceMethod
  private readonly accessor: KotlinAccessor | undefined
  private readonly callable: KotlinMethodInfo

  constructor({ method, accessor }: KotlinInstanceMethodOptions) {
    const callable = prepareKotlinMethod(method)
    let jvmName: string
    switch (accessor?.kind) {
      case 'getter':
        jvmName = accessor.property.getGetterName('jvm')
        break
      case 'setter':
        jvmName = accessor.property.getSetterName('jvm')
        break
      case undefined:
        jvmName = method.name
        break
    }
    let name: string
    if (callable.needsKotlinConversion) {
      name = `${jvmName}_cxx`
    } else {
      name = jvmName
    }
    let parameters: Parameter[]
    if (accessor?.kind === 'setter') {
      // Like Kotlin setters, name it `value`, which no conversion uses.
      parameters = callable.parameters.map((parameter) => new Parameter('value', parameter.type))
    } else {
      parameters = callable.parameters.map((parameter) => parameter.kotlin)
    }
    super(name, callable.returnType, parameters, {
      documentation: method.documentation,
      access: 'private',
      doNotStrip: true,
      generated: true,
    })
    this.returnType = callable.returnType
    this.nativeMethod = method
    this.accessor = accessor
    this.callable = callable
  }

  /** Whether JNI calls a private bridge instead of the public member. */
  get needsKotlinBridge(): boolean {
    return this.callable.needsKotlinConversion
  }

  createBridge({ nonvirtual = false }: KotlinInstanceBridgeOptions = {}): KotlinMethodBridge {
    const nativeMethod = this.nativeMethod
    const cppParameters = this.callable.parameters.map((parameter) => parameter.cpp)
    const cppMethod = new InstanceMethod(nativeMethod.name, this.callable.cppReturnType, cppParameters, {
      generated: true,
    })
    const isNonvirtual = nonvirtual || this.needsKotlinBridge
    const jniMethod = isNonvirtual ? 'getNonvirtualMethod' : 'getMethod'
    const jniMethodLookup = `CxxPart::getClass()->${jniMethod}`
    const jniDeclaringClass = isNonvirtual ? 'CxxPart::getClass()' : undefined
    const cppBody = createCppJniCallBody({
      callable: this.callable,
      jvmName: this.name,
      jniMethodLookup: jniMethodLookup,
      jniReceiver: '_javaPart',
      jniDeclaringClass: jniDeclaringClass,
    })
    const kotlinMethods: KotlinMethodDefinition[] = []
    if (this.needsKotlinBridge) {
      kotlinMethods.push({ method: this, body: this.getKotlinBridgeBody() })
    }
    return {
      kotlinMethods: kotlinMethods,
      cppMethods: [{ method: cppMethod, body: cppBody }],
    }
  }

  private getKotlinBridgeBody(): string {
    if (this.accessor == null) {
      return createKotlinBridgeBody({
        callable: this.callable,
        getKotlinInvocation: (args) => `${this.nativeMethod.name}(${args.join(', ')})`,
      })
    }
    // Kotlin property accessors cannot be called like methods.
    const propertyName = this.accessor.property.name
    switch (this.accessor.kind) {
      case 'getter': {
        const kotlinValue = this.returnType.convert(`this.${propertyName}`, {
          from: 'kotlin',
          to: 'c++',
          in: 'kotlin',
        })
        return `return ${kotlinValue}`
      }
      case 'setter': {
        const [parameter] = this.callable.parameters
        if (parameter == null) {
          throw new Error('A Kotlin property setter requires a value parameter.')
        }
        const publicValue = parameter.type.convert('value', {
          from: 'c++',
          to: 'kotlin',
          in: 'kotlin',
        })
        return `this.${propertyName} = ${publicValue}`
      }
    }
  }
}

/** The JNI accessors C++ calls for a property. */
export function getKotlinPropertyAccessors(property: Property): KotlinInstanceMethod[] {
  const accessors = [
    new KotlinInstanceMethod({
      method: property.cppGetter,
      accessor: { kind: 'getter', property: property },
    }),
  ]
  if (property.cppSetter != null) {
    accessors.push(
      new KotlinInstanceMethod({
        method: property.cppSetter,
        accessor: { kind: 'setter', property: property },
      })
    )
  }
  return accessors
}
