import type { HybridClassBindings } from '../c++/CppHybridClassBindings.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { SourceImport } from '../SourceFile.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { KotlinConstructor } from './KotlinConstructor.js'
import { KotlinStaticMethod } from './KotlinStaticMethod.js'
import { KotlinStaticProperty } from './KotlinStaticProperty.js'
import { getKotlinImplementation } from './KotlinMethodHelpers.js'
import {
  createKotlinDirectCode,
  fitsJavaScratch,
  getDirectFactoryName,
  getDirectMethods,
  type DirectMethod,
  type KotlinDirectCode,
} from '../direct/DirectCalls.js'

export interface KotlinClassMembers {
  constructor: KotlinConstructor | undefined
  staticMethods: KotlinStaticMethod[]
  staticProperties: KotlinStaticProperty[]
}

/** The constructor and static accessors and methods JavaScript calls on the class. */
export function getKotlinClassMembers(spec: HybridObjectSpec<'kotlin'>): KotlinClassMembers {
  let constructor: KotlinConstructor | undefined
  if (spec.constructor != null) {
    constructor = new KotlinConstructor({
      spec: spec,
      constructor: spec.constructor,
    })
  }
  const staticMethods = spec.staticMethods.map((method) => new KotlinStaticMethod({ spec: spec, method: method }))
  const staticProperties = spec.staticProperties.map((property) => new KotlinStaticProperty({ spec: spec, property: property }))
  return {
    constructor: constructor,
    staticMethods: staticMethods,
    staticProperties: staticProperties,
  }
}

interface KotlinHybridClassBindings extends HybridClassBindings {
  declarations: string[]
  /** Includes only the implementation file needs. */
  implementationImports: SourceImport[]
}

/** The static methods of the spec that get direct host functions on Android, see `DirectCalls.ts`. */
function getKotlinDirectMethods(spec: HybridObjectSpec<'kotlin'>): DirectMethod[] {
  return getDirectMethods(spec.staticMethods).filter(fitsJavaScratch)
}

/** The direct host functions of the spec's static methods, see `DirectCalls.ts`. */
export function getKotlinDirectCode(spec: HybridObjectSpec<'kotlin'>): KotlinDirectCode | undefined {
  if (spec.staticMethods.length === 0) return undefined
  const { HybridTSpec, JHybridTSpec } = getHybridObjectName(spec.name)
  const methods = getKotlinDirectMethods(spec)
  return createKotlinDirectCode(spec.config, HybridTSpec, JHybridTSpec, getKotlinImplementation(spec).className, methods)
}

/** Bind Kotlin class calls through JNI on the private native bridge. */
export function createKotlinHybridClassBindings(spec: HybridObjectSpec<'kotlin'>): KotlinHybridClassBindings {
  const imports: SourceImport[] = []
  const declarations: string[] = []
  const definitions: string[] = []
  const registrations: string[] = []
  const { constructor, staticMethods, staticProperties } = getKotlinClassMembers(spec)
  const callables: (KotlinConstructor | KotlinStaticMethod | KotlinStaticProperty)[] = []
  if (constructor != null) callables.push(constructor)
  callables.push(...staticMethods, ...staticProperties)
  if (callables.length === 0) {
    return {
      imports: imports,
      declarations: declarations,
      definitions: definitions,
      registrations: registrations,
      implementationImports: [],
    }
  }

  const { JHybridTSpec } = getHybridObjectName(spec.name)
  imports.push({
    language: 'c++',
    declaration: spec.config.getCxxHeader(`${JHybridTSpec}.hpp`, 'private'),
  })
  const implementationImports: SourceImport[] = []
  const directCode = getKotlinDirectCode(spec)
  const directMethods = getKotlinDirectMethods(spec)
  if (directCode != null) {
    implementationImports.push({ language: 'c++', declaration: { header: 'NitroModules/DirectCall.hpp', space: 'system' } })
    definitions.push(directCode.cpp.definitions)
    registrations.push(...directCode.cpp.setup)
  }
  for (const callable of callables) {
    const { cppMethods } = callable.createBridge()
    declarations.push(...cppMethods.map(({ method }) => method.getDeclaration('c++')))
    definitions.push(
      ...cppMethods.map(({ method, body }) =>
        method.getDefinition('c++', { placement: 'out-of-class', className: JHybridTSpec, body: body })
      )
    )
    if (callable instanceof KotlinStaticMethod) {
      const directMethod = directMethods.find((method) => method.name === callable.jsName)
      registrations.push(callable.getCppRegistration(JHybridTSpec, directMethod != null ? getDirectFactoryName(directMethod) : undefined))
    } else {
      registrations.push(callable.getCppRegistration(JHybridTSpec))
    }
    imports.push(...callable.getRequiredImports('c++'), ...cppMethods.flatMap(({ method }) => method.getRequiredImports('c++')))
  }
  return {
    imports: imports,
    declarations: declarations,
    definitions: definitions,
    registrations: registrations,
    implementationImports: implementationImports,
  }
}
