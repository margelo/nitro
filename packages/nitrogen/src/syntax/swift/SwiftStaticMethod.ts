import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { StaticMethod } from '../StaticMethod.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import {
  createCppBridgeBody,
  createSwiftEndpoint,
  getSwiftMethodImports,
  prepareSwiftMethod,
  type SwiftClassMethodOptions,
  type SwiftMethodBridge,
  type SwiftMethodInfo,
} from './SwiftMethodHelpers.js'
import type { SwiftType } from './types/SwiftType.js'

interface SwiftStaticMethodOptions {
  spec: HybridObjectSpec<'swift'>
  method: StaticMethod
}

export class SwiftStaticMethod extends StaticMethod {
  override readonly returnType: SwiftType
  private readonly nativeMethod: StaticMethod
  private readonly implementationClassName: string
  private readonly cppInvocationTarget: string
  private readonly callable: SwiftMethodInfo

  constructor({ spec, method }: SwiftStaticMethodOptions) {
    const implementation = spec.implementation
    if (implementation == null) {
      throw new Error(`${spec.name}: Cannot generate a static method without a Swift implementation.`)
    }
    const callable = prepareSwiftMethod(method, true, spec.config)
    const parameters = callable.parameters.map((parameter) => parameter.swift)
    super(method.name, callable.returnType, parameters, {
      documentation: method.documentation,
      generated: true,
    })
    this.returnType = callable.returnType
    this.nativeMethod = method
    this.implementationClassName = implementation.className
    const hybridObjectNames = getHybridObjectName(spec.name)
    this.cppInvocationTarget = `::${spec.config.getIosModuleName()}::${hybridObjectNames.HybridTSpecCxx}`
    this.callable = callable
  }

  createBridge(cppClassName: string, swiftOptions: SwiftClassMethodOptions = {}): SwiftMethodBridge {
    const nativeMethod = this.nativeMethod
    const cppBridgeBody = createCppBridgeBody({
      callable: this.callable,
      getCppInvocation: (args) => `${this.cppInvocationTarget}::${nativeMethod.name}(${args.join(', ')})`,
    })
    const endpoint = createSwiftEndpoint({
      callable: this.callable,
      getSwiftInvocation: (args) => {
        const argumentsList = args.map((arg) => `${arg.name}: ${arg.code}`)
        return `try ${this.implementationClassName}.${nativeMethod.name}(${argumentsList.join(', ')})`
      },
    })
    const swiftMethod = new StaticMethod(nativeMethod.name, endpoint.returnType, endpoint.parameters, {
      ...swiftOptions,
      access: 'public',
      throwing: false,
      generated: true,
    })
    return {
      cppMethods: [{ method: this, body: cppBridgeBody }],
      swiftMethod: { method: swiftMethod, body: endpoint.body },
      swiftImports: getSwiftMethodImports(this.callable),
      cppRegistrations: [`clazz.registerStaticHybridMethod("${nativeMethod.name}", &${cppClassName}::${this.name});`],
    }
  }
}
