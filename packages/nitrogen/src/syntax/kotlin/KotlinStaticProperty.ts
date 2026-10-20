import type { Language } from '../../getPlatformSpecs.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { SourceImport } from '../SourceFile.js'
import { StaticMethod } from '../StaticMethod.js'
import { StaticProperty } from '../StaticProperty.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import {
  createCppJniCallBody,
  createKotlinForwarderBody,
  getKotlinImplementation,
  prepareKotlinMethod,
  type KotlinMethodBridge,
  type KotlinMethodInfo,
} from './KotlinMethodHelpers.js'

interface KotlinStaticPropertyOptions {
  spec: HybridObjectSpec<'kotlin'>
  property: StaticProperty
}

interface KotlinStaticAccessor {
  nativeMethod: StaticMethod
  kotlinMethod: StaticMethod
  callable: KotlinMethodInfo
}

/** Static property access through the implementation's Kotlin companion object. */
export class KotlinStaticProperty extends StaticProperty {
  private readonly implementationClassName: string
  private readonly jniClass: string
  private readonly getter: KotlinStaticAccessor
  private readonly setter: KotlinStaticAccessor | undefined

  constructor({ spec, property }: KotlinStaticPropertyOptions) {
    super(property.name, property.type, property.isReadonly)
    this.implementationClassName = getKotlinImplementation(spec).className
    const { JHybridTSpec } = getHybridObjectName(spec.name)
    this.jniClass = `${JHybridTSpec}::JavaPart::javaClassStatic()`
    const [getter, setter] = property.getStaticMethods()
    this.getter = this.createAccessor(getter)
    this.setter = setter == null ? undefined : this.createAccessor(setter)
  }

  override getRequiredImports(language: Language): SourceImport[] {
    return [
      ...this.getter.kotlinMethod.getRequiredImports(language),
      ...(this.setter?.kotlinMethod.getRequiredImports(language) ?? []),
    ]
  }

  createBridge(): KotlinMethodBridge {
    const property = `${this.implementationClassName}.${this.name}`
    const bridges = [this.createAccessorBridge(this.getter, () => property)]
    if (this.setter != null) {
      bridges.push(
        this.createAccessorBridge(this.setter, (args) => {
          const argument = args[0]
          if (argument == null) {
            throw new Error(
              'A Kotlin static property setter requires a value parameter.'
            )
          }
          return `${property} = ${argument}`
        })
      )
    }
    return {
      kotlinMethods: bridges.flatMap((bridge) => bridge.kotlinMethods),
      cppMethods: bridges.flatMap((bridge) => bridge.cppMethods),
    }
  }

  getCppRegistration(cppClassName: string): string {
    const references = this.getStaticMethods().map(
      (accessor) => `&${cppClassName}::${accessor.name}`
    )
    return `clazz.registerStaticHybridProperty("${this.name}", ${references.join(', ')});`
  }

  private createAccessor(nativeMethod: StaticMethod): KotlinStaticAccessor {
    const callable = prepareKotlinMethod(nativeMethod)
    const kotlinMethod = new StaticMethod(
      `${nativeMethod.name}_cxx`,
      callable.returnType,
      callable.parameters.map((parameter) => parameter.kotlin),
      { access: 'private', doNotStrip: true, generated: true }
    )
    return {
      nativeMethod: nativeMethod,
      kotlinMethod: kotlinMethod,
      callable: callable,
    }
  }

  private createAccessorBridge(
    { nativeMethod, kotlinMethod, callable }: KotlinStaticAccessor,
    getKotlinInvocation: (args: string[]) => string
  ): KotlinMethodBridge {
    const cppBody = createCppJniCallBody({
      callable: callable,
      jvmName: kotlinMethod.name,
      jniMethodLookup: `${this.jniClass}->getStaticMethod`,
      jniReceiver: this.jniClass,
    })
    const kotlinBody = createKotlinForwarderBody({
      callable: callable,
      getKotlinInvocation: getKotlinInvocation,
    })
    return {
      kotlinMethods: [{ method: kotlinMethod, body: kotlinBody }],
      cppMethods: [{ method: nativeMethod, body: cppBody }],
    }
  }
}
