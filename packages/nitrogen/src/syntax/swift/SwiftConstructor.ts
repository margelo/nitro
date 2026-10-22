import { Constructor } from '../Constructor.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { StaticMethod } from '../StaticMethod.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
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

interface SwiftConstructorOptions {
  spec: HybridObjectSpec<'swift'>
  constructor: Constructor
  factoryName?: string
}

export class SwiftConstructor extends Constructor {
  override readonly returnType: SwiftType
  private readonly nativeFactory: StaticMethod
  private readonly implementationClassName: string
  private readonly cppInvocationTarget: string
  private readonly callable: SwiftMethodInfo

  constructor({ spec, constructor, factoryName = 'constructor' }: SwiftConstructorOptions) {
    const implementation = spec.implementation
    if (implementation == null) {
      throw new Error(`${spec.name}: Cannot generate a constructor without a Swift implementation.`)
    }
    const returnType = new HybridObjectType(spec)
    const nativeFactory = constructor.toStaticMethod(returnType, factoryName)
    const callable = prepareSwiftMethod(nativeFactory, true, spec.config)
    const parameters = callable.parameters.map((parameter) => parameter.swift)
    super(constructor.name, callable.returnType, parameters, {
      generated: true,
    })
    this.returnType = callable.returnType
    this.nativeFactory = nativeFactory
    this.implementationClassName = implementation.className
    const hybridObjectNames = getHybridObjectName(spec.name)
    this.cppInvocationTarget = `::${spec.config.getAppleModuleName()}::${hybridObjectNames.HybridTSpecCxx}`
    this.callable = callable
  }

  createBridge(cppClassName: string, swiftOptions: SwiftClassMethodOptions = {}): SwiftMethodBridge {
    // The C++ bridge calls static factories rather than C++ constructors.
    const nativeFactory = this.nativeFactory
    const swiftFactory = new StaticMethod(nativeFactory.name, this.returnType, this.parameters, { generated: true })
    const cppBridgeBody = createCppBridgeBody({
      callable: this.callable,
      getCppInvocation: (args) => `${this.cppInvocationTarget}::${nativeFactory.name}(${args.join(', ')})`,
    })
    const endpoint = createSwiftEndpoint({
      callable: this.callable,
      getSwiftInvocation: (args) => {
        const argumentsList = args.map((arg) => `${arg.name}: ${arg.code}`)
        return `try ${this.implementationClassName}(${argumentsList.join(', ')})`
      },
    })
    const swiftMethod = new StaticMethod(nativeFactory.name, endpoint.returnType, endpoint.parameters, {
      ...swiftOptions,
      access: 'public',
      throwing: false,
      generated: true,
    })
    const cppRegistration = `
clazz.registerHybridConstructor(&${cppClassName}::${swiftFactory.name});
`.trim()
    return {
      cppMethods: [{ method: swiftFactory, body: cppBridgeBody }],
      swiftMethod: { method: swiftMethod, body: endpoint.body },
      swiftImports: getSwiftMethodImports(this.callable),
      cppRegistrations: [cppRegistration],
    }
  }
}
