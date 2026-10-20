import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { SourceImport } from '../SourceFile.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { indent } from '../../utils.js'

/** Code that binds a spec's constructor and static members in its `Class::get()`. */
export interface HybridClassBindings {
  imports: SourceImport[]
  definitions: string[]
  registrations: string[]
}

/** Bind concrete C++ class calls inside the platform's `Class::get()`. */
export function createCppHybridClassBindings(
  spec: HybridObjectSpec<'c++'>
): HybridClassBindings {
  const imports: SourceImport[] = []
  const definitions: string[] = []
  const registrations: string[] = []
  if (
    spec.constructor == null &&
    spec.staticMethods.length === 0 &&
    spec.staticProperties.length === 0
  ) {
    return {
      imports: imports,
      definitions: definitions,
      registrations: registrations,
    }
  }
  if (spec.implementation == null) {
    throw new Error(
      `${spec.name}: Constructors and static members require a concrete implementation.`
    )
  }

  const implementation = [
    '',
    ...spec.implementation.namespace,
    spec.implementation.className,
  ].join('::')
  const include = spec.implementation.include
  const headerName = include.slice(1, -1)
  const headerSpace = include.startsWith('<') ? 'system' : 'user'
  const { HybridTSpec } = getHybridObjectName(spec.name)
  const helper = `${HybridTSpec}Bindings`
  const adapters: string[] = []
  imports.push(
    { language: 'c++', declaration: { name: 'utility', space: 'system' } },
    {
      language: 'c++',
      declaration: { name: headerName, space: headerSpace },
    }
  )
  if (spec.constructor != null) {
    const method = spec.constructor.toStaticMethod(new HybridObjectType(spec))
    const argumentTypes = method.parameters.map(
      (parameter) => `decltype(${parameter.type.escapedName})`
    )
    const argumentsCode = method.parameters.map(
      (parameter) =>
        `std::forward<decltype(${parameter.type.escapedName})>(${parameter.type.escapedName})`
    )
    const constructibleArguments = [implementation, ...argumentTypes]
    const constructorBody = `
static_assert(std::is_constructible_v<${constructibleArguments.join(', ')}>,
              "${spec.name}: ${implementation} must implement the declared public constructor.");
return std::make_shared<${implementation}>(${argumentsCode.join(', ')});
`.trim()
    adapters.push(
      method.getDefinition('c++', {
        placement: 'in-class',
        body: constructorBody,
      })
    )
    imports.push(
      {
        language: 'c++',
        declaration: { name: 'memory', space: 'system' },
      },
      {
        language: 'c++',
        declaration: { name: 'type_traits', space: 'system' },
      }
    )
    const constructorRegistration = `
clazz.registerHybridConstructor(&${helper}::constructor);
`.trim()
    registrations.push(constructorRegistration)
  }
  for (const method of spec.staticMethods) {
    const argumentsCode = method.parameters.map(
      (parameter) =>
        `std::forward<decltype(${parameter.type.escapedName})>(${parameter.type.escapedName})`
    )
    const staticCallBody = `
return ${implementation}::${method.name}(${argumentsCode.join(', ')});
`.trim()
    adapters.push(
      method.getDefinition('c++', {
        placement: 'in-class',
        body: staticCallBody,
      })
    )
    const staticMethodRegistration = `
clazz.registerStaticHybridMethod("${method.name}", &${helper}::${method.name});
`.trim()
    registrations.push(staticMethodRegistration)
  }
  for (const property of spec.staticProperties) {
    const accessors = property.getStaticMethods()
    for (const method of accessors) {
      const argumentsCode = method.parameters.map(
        (parameter) =>
          `std::forward<decltype(${parameter.type.escapedName})>(${parameter.type.escapedName})`
      )
      adapters.push(
        method.getDefinition('c++', {
          placement: 'in-class',
          body: `return ${implementation}::${method.name}(${argumentsCode.join(', ')});`,
        })
      )
    }
    const accessorReferences = accessors.map(
      (method) => `&${helper}::${method.name}`
    )
    registrations.push(
      `clazz.registerStaticHybridProperty("${property.name}", ${accessorReferences.join(', ')});`
    )
  }
  const helperDefinition = `
namespace {
  struct ${helper} final {
    ${indent(adapters.join('\n\n'), '    ')}
  };
}
`.trim()
  definitions.push(helperDefinition)
  return {
    imports: imports,
    definitions: definitions,
    registrations: registrations,
  }
}
