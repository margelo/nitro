import type { ClassDeclaration, Type } from 'ts-morph'
import { Node } from 'ts-morph'
import { z } from 'zod'
import { getDirectBaseTypes, getHybridObjectNitroModuleConfig } from './utils.js'
import { getHybridObjectDecoratorOptions, type DecoratorOptions } from './getHybridObjectDecoratorOptions.js'
import { getHybridClassManifestOptions } from './hybridClassManifest.js'
import { NitroConfig } from './config/NitroConfig.js'
import type { SourceImport } from './syntax/SourceFile.js'

const platformSchema = z.enum(['apple', 'android'])
export type Platform = z.infer<typeof platformSchema>
export type Language = 'c++' | 'swift' | 'kotlin'

const nativeNameSchema = z.string().min(1)

interface DuplicateNameCheck {
  /** The name of each array entry, in order. */
  names: string[]
  /** The entry key holding the name. */
  key: string
  getMessage: (name: string) => string
}

/** Reports every array entry whose name an earlier entry already uses. */
function addDuplicateNameIssues(context: z.RefinementCtx, { names, key, getMessage }: DuplicateNameCheck): void {
  const seenNames = new Set<string>()
  for (const [index, name] of names.entries()) {
    if (seenNames.has(name)) {
      context.addIssue({
        code: 'custom',
        path: [index, key],
        message: getMessage(name),
      })
    }
    seenNames.add(name)
  }
}

const swiftImplementationSchema = z.strictObject({
  className: nativeNameSchema,
})
const swiftProtocolConformanceSchema = z.strictObject({
  protocol: nativeNameSchema,
  module: nativeNameSchema.optional(),
})
const swiftProtocolConformancesSchema = z
  .array(swiftProtocolConformanceSchema)
  .superRefine((conformances, context) => {
    addDuplicateNameIssues(context, {
      names: conformances.map((conformance) => conformance.protocol),
      key: 'protocol',
      getMessage: (protocol) => `Swift protocol "${protocol}" is listed more than once.`,
    })
  })
  .default([])
const swiftOptions = {
  protocolConformances: swiftProtocolConformancesSchema,
}
const kotlinImplementedInterfaceSchema = z.strictObject({
  interface: z
    .string()
    .regex(
      /^[A-Za-z_][A-Za-z0-9_]*$/,
      'Use the simple name of the Kotlin interface without type arguments, e.g. "View". For a nested interface, put its outer class in `package`, e.g. "android.view.SurfaceHolder".'
    ),
  package: nativeNameSchema,
})
const kotlinImplementedInterfacesSchema = z
  .array(kotlinImplementedInterfaceSchema)
  .superRefine((implementedInterfaces, context) => {
    addDuplicateNameIssues(context, {
      names: implementedInterfaces.map((implementedInterface) => implementedInterface.interface),
      key: 'interface',
      getMessage: (name) => `Kotlin interface "${name}" is listed more than once.`,
    })
  })
  .default([])
const kotlinOptions = {
  implementedInterfaces: kotlinImplementedInterfacesSchema,
}
// Decorators and manifests store include syntax; generators consume typed imports.
const cppIncludeSchema = z.string().transform((include, context): SourceImport<'c++'> => {
  const match = /^(?:<([^<>"\r\n]+)>|"([^<>"\r\n]+)")$/.exec(include)
  const systemHeader = match?.[1]
  const userHeader = match?.[2]
  const header = systemHeader ?? userHeader
  // `$` can match before a final newline, so require the entire input to match.
  if (match?.[0] !== include || header == null) {
    context.addIssue({
      code: 'custom',
      message: 'Use a complete C++ include, such as <Library/HybridImage.hpp> or "HybridImage.hpp".',
    })
    return z.NEVER
  }
  const space = systemHeader != null ? 'system' : 'user'
  return {
    language: 'c++',
    declaration: { header: header, space: space },
  }
})
const cppImplementationSchema = z.strictObject({
  namespace: z.array(nativeNameSchema).default([]),
  include: cppIncludeSchema,
  className: nativeNameSchema,
})
const kotlinImplementationSchema = z.strictObject({
  package: z.array(nativeNameSchema).default([]),
  className: nativeNameSchema,
})

const concreteImplementationOptions = {
  allowInheritance: z.literal(false).default(false),
  allowMultipleImplementations: z.never().optional(),
}
const multipleImplementationOptions = {
  allowInheritance: z.boolean().default(false),
  allowMultipleImplementations: z.literal(true),
  implementation: z.never().optional(),
}
const platformOptionsSchema = z.union([
  z.strictObject({
    ...concreteImplementationOptions,
    ...swiftOptions,
    language: z.literal('swift'),
    implementation: swiftImplementationSchema,
  }),
  z.strictObject({
    ...concreteImplementationOptions,
    language: z.literal('c++'),
    implementation: cppImplementationSchema,
  }),
  z.strictObject({
    ...concreteImplementationOptions,
    ...kotlinOptions,
    language: z.literal('kotlin'),
    implementation: kotlinImplementationSchema,
  }),
  z.strictObject({
    ...multipleImplementationOptions,
    ...swiftOptions,
    language: z.literal('swift'),
  }),
  z.strictObject({
    ...multipleImplementationOptions,
    language: z.literal('c++'),
  }),
  z.strictObject({
    ...multipleImplementationOptions,
    ...kotlinOptions,
    language: z.literal('kotlin'),
  }),
])
export type HybridObjectPlatformOptions = z.infer<typeof platformOptionsSchema>
export type HybridObjectPlatforms = Partial<Record<Platform, HybridObjectPlatformOptions>>

const platformOptionsSchemas = {
  apple: platformOptionsSchema.refine((options) => options.language !== 'kotlin', {
    path: ['language'],
    message: 'Apple platforms support only Swift and C++ implementations.',
  }),
  android: platformOptionsSchema.refine((options) => options.language !== 'swift', {
    path: ['language'],
    message: 'Android supports only Kotlin and C++ implementations.',
  }),
}

/** Resolve native implementations within the project owning the spec. */
function resolvePlatformImplementation(options: HybridObjectPlatformOptions, type: Type): HybridObjectPlatformOptions {
  if (options.implementation == null || options.language === 'swift') {
    return options
  }
  const config = getHybridObjectNitroModuleConfig(type) ?? NitroConfig.current

  switch (options.language) {
    case 'c++':
      return {
        ...options,
        implementation: {
          ...options.implementation,
          namespace: config.getCxxNamespace('c++', ...options.implementation.namespace).split('::'),
        },
      }
    case 'kotlin':
      return {
        ...options,
        implementation: {
          ...options.implementation,
          package: config.getAndroidPackageDirectory(...options.implementation.package),
        },
      }
  }
}

/** Matches the root HybridObject class, excluding derived specs. */
export function isHybridObjectBaseClass(type: Type): boolean {
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  return symbol?.getName() === 'HybridObject'
}

/** Matches direct and indirect HybridObject descendants, excluding the root class. */
export function isSomeHybridObject(type: Type): boolean {
  return getDirectBaseTypes(type).some((base) => isHybridObjectBaseClass(base) || isSomeHybridObject(base))
}

export function isDirectlyAnyHybridObject(type: Type): boolean {
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  return symbol?.getName() === 'AnyHybridObject'
}

export function isHybridView(type: Type): boolean {
  return getDirectBaseTypes(type).some((base) => isHybridViewBaseClass(base) || isHybridView(base))
}

/** The React Native marker is supplied by the runtime, not generated as a spec. */
export function isHybridViewBaseClass(type: Type): boolean {
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  return symbol?.getName() === 'HybridView'
}

/** Returns only the platforms explicitly configured on this class. */
export function getHybridObjectPlatforms(declaration: ClassDeclaration): HybridObjectPlatforms {
  const literalOptions = getHybridObjectLiteralOptions(declaration)
  return parseHybridObjectPlatforms({
    declaration: declaration,
    literalOptions: literalOptions,
  })
}

/**
 * Returns the platform options as written in the class's decorators, or in
 * its package's manifest when the class comes from tsc's `.nitro.d.ts` output.
 */
export function getHybridObjectLiteralOptions(declaration: ClassDeclaration): DecoratorOptions {
  const name = declaration.getName()
  if (name == null) {
    throw new Error('HybridObject classes must have a name.')
  }
  if (declaration.getTypeParameters().length > 0) {
    throw new Error(`${name}: Generic HybridObject specs are not supported.`)
  }
  const decoratorOptions = getHybridObjectDecoratorOptions(declaration, name)
  if (decoratorOptions != null) return decoratorOptions
  // tsc removes the decorators when it emits a spec as .nitro.d.ts.
  if (declaration.getSourceFile().getBaseName().endsWith('.nitro.d.ts')) {
    return getHybridClassManifestOptions(declaration, name)
  }
  throw new Error(`${name}: Declare \`@iOS(...)\` or \`@Android(...)\` on this class in its \`.nitro.ts\` spec.`)
}

interface ParseHybridObjectPlatformsOptions {
  declaration: ClassDeclaration
  literalOptions: DecoratorOptions
}

/** Validates a class's literal platform options and resolves their implementations. */
export function parseHybridObjectPlatforms({ declaration, literalOptions }: ParseHybridObjectPlatformsOptions): HybridObjectPlatforms {
  const platforms = platformSchema.options.filter((platform) => literalOptions[platform] != null)
  const entries = platforms.map((platform): [Platform, HybridObjectPlatformOptions] => {
    const options = platformOptionsSchemas[platform].parse(literalOptions[platform])
    return [platform, resolvePlatformImplementation(options, declaration.getType())]
  })
  return Object.fromEntries(entries)
}

export function getHybridObjectPlatformsForType(type: Type): HybridObjectPlatforms {
  const symbol = type.getSymbol()
  const declaration = symbol?.getDeclarations().find(Node.isClassDeclaration)
  if (declaration == null) {
    throw new Error(`Cannot find the HybridObject declaration for ${type.getText()}.`)
  }
  return getHybridObjectPlatforms(declaration)
}
