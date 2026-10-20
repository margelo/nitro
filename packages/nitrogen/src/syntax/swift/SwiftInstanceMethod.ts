import { InstanceMethod } from '../InstanceMethod.js'
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
import type { SwiftType } from './types/SwiftType.js'

interface SwiftInstanceMethodOptions {
  method: InstanceMethod
  accessor?: { kind: 'getter' | 'setter'; name: string }
}

export class SwiftInstanceMethod extends InstanceMethod {
  override readonly returnType: SwiftType
  private readonly nativeMethod: InstanceMethod
  private readonly accessor: SwiftInstanceMethodOptions['accessor']
  private readonly callable: SwiftMethodInfo

  constructor({ method, accessor }: SwiftInstanceMethodOptions) {
    const callable = prepareSwiftMethod(method, accessor == null)
    const parameters = callable.parameters.map((parameter) => parameter.swift)
    super(`${method.name}_Swift`, callable.returnType, parameters, {
      generated: true,
    })
    this.returnType = callable.returnType
    this.nativeMethod = method
    this.accessor = accessor
    this.callable = callable
  }

  createBridge(cppClassName: string): SwiftMethodBridge {
    const nativeMethod = this.nativeMethod
    // Non-throwing accessors can still require throwing C++ conversions.
    const forwarder = new InstanceMethod(
      nativeMethod.name,
      nativeMethod.returnType,
      nativeMethod.parameters,
      { override: true, generated: true }
    )
    const cppForwarderBody = createCppForwarderBody({
      nativeMethod: nativeMethod,
      swiftMethod: this,
    })
    const cppBridgeBody = createCppBridgeBody({
      callable: this.callable,
      getCppInvocation: (args) =>
        `_swiftPart.${nativeMethod.name}(${args.join(', ')})`,
    })
    const endpoint = createSwiftEndpoint({
      callable: this.callable,
      getSwiftInvocation: (args) => this.getSwiftInvocation(args),
    })
    const swiftMethod = new InstanceMethod(
      nativeMethod.name,
      endpoint.returnType,
      endpoint.parameters,
      { access: 'public', final: true, throwing: false, generated: true }
    )
    const cppRegistrations: string[] = []
    if (this.accessor == null) {
      cppRegistrations.push(
        `clazz.registerHybridMethod("${nativeMethod.name}", &${cppClassName}::${this.name});`
      )
    }
    return {
      cppMethods: [
        { method: forwarder, body: cppForwarderBody },
        { method: this, body: cppBridgeBody },
      ],
      swiftMethod: { method: swiftMethod, body: endpoint.body },
      swiftImports: getSwiftMethodImports(this.callable),
      cppRegistrations: cppRegistrations,
    }
  }

  private getSwiftInvocation(args: SwiftArgument[]): string {
    if (this.accessor == null) {
      const argumentsList = args.map((arg) => `${arg.name}: ${arg.code}`)
      return `try __implementation.${this.nativeMethod.name}(${argumentsList.join(', ')})`
    }
    switch (this.accessor.kind) {
      case 'getter':
        return `__implementation.${this.accessor.name}`
      case 'setter': {
        const argument = args[0]
        if (argument == null) {
          throw new Error('A Swift property setter requires a value parameter.')
        }
        return `__implementation.${this.accessor.name} = ${argument.code}`
      }
    }
  }
}
