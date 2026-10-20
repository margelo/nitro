import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { StaticMethod } from '../StaticMethod.js'
import { StaticProperty } from '../StaticProperty.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import {
  createCppBridgeBody,
  createCppForwarderBody,
  createSwiftEndpoint,
  getSwiftMethodImports,
  prepareSwiftMethod,
  type SwiftArgument,
  type SwiftMethodBridge,
  type SwiftMethodInfo,
} from './SwiftMethodHelpers.js'

interface SwiftStaticPropertyOptions {
  spec: HybridObjectSpec<'swift'>
  property: StaticProperty
}

interface SwiftStaticAccessor {
  nativeMethod: StaticMethod
  swiftMethod: StaticMethod
  endpointName: string
  callable: SwiftMethodInfo
}

/** Nonthrowing static property access on the concrete Swift implementation. */
export class SwiftStaticProperty extends StaticProperty {
  private readonly implementationClassName: string
  private readonly cppInvocationTarget: string
  private readonly endpointSuffix: string
  private readonly getter: SwiftStaticAccessor
  private readonly setter: SwiftStaticAccessor | undefined

  constructor({ spec, property }: SwiftStaticPropertyOptions) {
    super(property.name, property.type, property.isReadonly)
    const implementation = spec.implementation
    if (implementation == null) {
      throw new Error(
        `${spec.name}: Cannot generate a static property without a Swift implementation.`
      )
    }
    this.implementationClassName = implementation.className
    const moduleName = spec.config.getIosModuleName()
    const { HybridTSpecCxx } = getHybridObjectName(spec.name)
    this.cppInvocationTarget = `${moduleName}::${HybridTSpecCxx}`
    // Plain property results can have identical inherited signatures, even
    // across modules. Qualify each endpoint with its declaring module and spec.
    this.endpointSuffix = `${moduleName}_${spec.name}`
    const [getter, setter] = property.getStaticMethods()
    this.getter = this.createAccessor(getter)
    this.setter = setter == null ? undefined : this.createAccessor(setter)
  }

  createBridges(
    inheritedClassMethods: ReadonlySet<string> = new Set()
  ): SwiftMethodBridge[] {
    const property = `${this.implementationClassName}.${this.name}`
    const bridges = [
      this.createAccessorBridge(
        this.getter,
        () => property,
        inheritedClassMethods
      ),
    ]
    if (this.setter != null) {
      bridges.push(
        this.createAccessorBridge(
          this.setter,
          (args) => {
            const argument = args[0]
            if (argument == null) {
              throw new Error(
                'A Swift static property setter requires a value parameter.'
              )
            }
            return `${property} = ${argument.code}`
          },
          inheritedClassMethods
        )
      )
    }
    return bridges
  }

  getCppRegistration(cppClassName: string): string {
    const references = [
      this.getter,
      ...(this.setter == null ? [] : [this.setter]),
    ].map((accessor) => `&${cppClassName}::${accessor.swiftMethod.name}`)
    return `clazz.registerStaticHybridProperty("${this.name}", ${references.join(', ')});`
  }

  private createAccessor(nativeMethod: StaticMethod): SwiftStaticAccessor {
    const callable = prepareSwiftMethod(nativeMethod, false)
    const swiftMethod = new StaticMethod(
      `${nativeMethod.name}_Swift`,
      callable.returnType,
      callable.parameters.map((parameter) => parameter.swift),
      { generated: true }
    )
    return {
      nativeMethod: nativeMethod,
      swiftMethod: swiftMethod,
      endpointName: `${nativeMethod.name}_${this.endpointSuffix}`,
      callable: callable,
    }
  }

  private createAccessorBridge(
    { nativeMethod, swiftMethod, endpointName, callable }: SwiftStaticAccessor,
    getSwiftInvocation: (args: SwiftArgument[]) => string,
    inheritedClassMethods: ReadonlySet<string>
  ): SwiftMethodBridge {
    // Swift accessors do not throw, but the C++ conversions still can.
    const cppForwarderBody = createCppForwarderBody({
      nativeMethod: nativeMethod,
      swiftMethod: swiftMethod,
    })
    const cppBridgeBody = createCppBridgeBody({
      callable: callable,
      getCppInvocation: (args) =>
        `${this.cppInvocationTarget}::${endpointName}(${args.join(', ')})`,
    })
    const endpoint = createSwiftEndpoint({
      callable: callable,
      getSwiftInvocation: getSwiftInvocation,
    })
    const endpointOptions = {
      access: 'public',
      throwing: false,
      generated: true,
    } as const
    const declaration = new StaticMethod(
      endpointName,
      endpoint.returnType,
      endpoint.parameters,
      endpointOptions
    ).getDeclaration('swift')
    const exportedMethod = new StaticMethod(
      endpointName,
      endpoint.returnType,
      endpoint.parameters,
      {
        ...endpointOptions,
        override: inheritedClassMethods.has(declaration),
      }
    )
    return {
      cppMethods: [
        { method: nativeMethod, body: cppForwarderBody },
        { method: swiftMethod, body: cppBridgeBody },
      ],
      swiftMethod: { method: exportedMethod, body: endpoint.body },
      swiftImports: getSwiftMethodImports(callable),
      cppRegistrations: [],
    }
  }
}
