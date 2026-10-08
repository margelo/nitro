import { z } from 'zod'

// Namespaces and package names in C++/Java will be matched with a regex.
const safeNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const isNotReservedKeyword = (val: string) =>
  !['core', 'nitro', 'NitroModules'].includes(val)
const isReservedKeywordError = {
  message: `This value is reserved and cannot be used!`,
}

const autolinkingLanguageSchema = z.enum(['c++', 'swift', 'kotlin'])

const autolinkingAllImplementationSchema = z.object({
  language: z.literal('c++'),
  implementationClassName: z.string(),
})

const autolinkingIOSImplementationSchema = z.object({
  language: z.enum(['c++', 'swift']),
  implementationClassName: z.string(),
})

const autolinkingAndroidImplementationSchema = z.object({
  language: z.enum(['c++', 'kotlin']),
  implementationClassName: z.string(),
})

const autolinkingWindowsImplementationSchema = z.object({
  language: z.literal('c++'),
  implementationClassName: z.string(),
})

const autolinkingPlatformImplementationSchema = z.object({
  language: autolinkingLanguageSchema,
  implementationClassName: z.string(),
})

const autolinkingModernHybridObjectSchema = z
  .object({
    all: autolinkingAllImplementationSchema.optional(),
    ios: autolinkingIOSImplementationSchema.optional(),
    android: autolinkingAndroidImplementationSchema.optional(),
    windows: autolinkingWindowsImplementationSchema.optional(),
  })
  .catchall(autolinkingPlatformImplementationSchema)
  .superRefine((value, ctx) => {
    const hasAll = value.all != null
    const platformCount = Object.keys(value).filter(
      (key) => key !== 'all'
    ).length

    if (hasAll && platformCount > 0) {
      ctx.addIssue({
        code: 'custom',
        message: '"all" cannot be combined with platform-specific entries.',
      })
    }

    if (!hasAll && platformCount === 0) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Each autolinking entry must declare either "all" or at least one platform.',
      })
    }
  })

const autolinkingLegacyHybridObjectSchema = z
  .object({
    cpp: z.string().optional(),
    swift: z.string().optional(),
    kotlin: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasCpp = value.cpp != null
    const hasSwift = value.swift != null
    const hasKotlin = value.kotlin != null

    if (!hasCpp && !hasSwift && !hasKotlin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Each autolinking entry must declare at least one implementation.',
      })
    }

    if (hasCpp && (hasSwift || hasKotlin)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Legacy autolinking entries cannot mix "cpp" with "swift"/"kotlin".',
      })
    }
  })

function normalizeLegacyAutolinkingHybridObject(
  value: z.infer<typeof autolinkingLegacyHybridObjectSchema>
): z.infer<typeof autolinkingModernHybridObjectSchema> {
  if (value.cpp != null) {
    return {
      all: {
        language: 'c++',
        implementationClassName: value.cpp,
      },
    }
  }

  const normalized: z.infer<typeof autolinkingModernHybridObjectSchema> = {}
  if (value.swift != null) {
    normalized.ios = {
      language: 'swift',
      implementationClassName: value.swift,
    }
  }
  if (value.kotlin != null) {
    normalized.android = {
      language: 'kotlin',
      implementationClassName: value.kotlin,
    }
  }
  return normalized
}

const autolinkingHybridObjectSchema = z.union([
  autolinkingModernHybridObjectSchema,
  autolinkingLegacyHybridObjectSchema.transform(
    normalizeLegacyAutolinkingHybridObject
  ),
])

export type AutolinkingAllImplementation = z.infer<
  typeof autolinkingAllImplementationSchema
>
export type AutolinkingIOSImplementation = z.infer<
  typeof autolinkingIOSImplementationSchema
>
export type AutolinkingAndroidImplementation = z.infer<
  typeof autolinkingAndroidImplementationSchema
>
export type AutolinkingWindowsImplementation = z.infer<
  typeof autolinkingWindowsImplementationSchema
>
export type AutolinkingPlatformImplementation = z.infer<
  typeof autolinkingPlatformImplementationSchema
>
export type AutolinkingHybridObject = z.infer<
  typeof autolinkingHybridObjectSchema
>

export const NitroUserConfigSchema = z.object({
  /**
   * Represents the C++ namespace of the module that will be generated.
   *
   * This can have multiple sub-namespaces, and is always relative to `margelo::nitro`.
   * @example `['image']` -> `margelo::nitro::image`
   */
  cxxNamespace: z
    .array(
      z
        .string()
        .regex(safeNamePattern)
        .refine(isNotReservedKeyword, isReservedKeywordError)
    )
    .min(1),
  /**
   * iOS specific options.
   */
  ios: z.object({
    /**
     * Represents the iOS module name of the module that will be generated.
     *
     * This will be used to generate Swift bridges, as those are always namespaced within the clang module.
     *
     * If you are using CocoaPods, this should be the Pod name defined in the `.podspec`.
     * @example `NitroTest`
     */
    iosModuleName: z
      .string()
      .regex(safeNamePattern)
      .refine(isNotReservedKeyword, isReservedKeywordError),
  }),
  /**
   * Android specific options.
   */
  android: z.object({
    /**
     * Represents the Android namespace ("package") of the module that will be generated.
     *
     * This can have multiple sub-namespaces, and is always relative to `com.margelo.nitro`.
     * @example `['image']` -> `com.margelo.nitro.image`
     */
    androidNamespace: z
      .array(
        z
          .string()
          .regex(safeNamePattern)
          .refine(isNotReservedKeyword, isReservedKeywordError)
      )
      .min(1),

    /**
     * Represents the name of the Android C++ library (aka name in CMakeLists.txt `add_library(..)`).
     * This will be loaded via `System.loadLibrary(...)`.
     * @example `NitroTest`
     */
    androidCxxLibName: z
      .string()
      .regex(safeNamePattern)
      .refine(isNotReservedKeyword, isReservedKeywordError),
  }),
  /**
   * Windows specific options.
   *
   * This is optional - if it is omitted, {@linkcode ios.iosModuleName} is used as the
   * Windows module name as well.
   */
  windows: z
    .object({
      /**
       * Represents the Windows module name of the module that will be generated.
       *
       * This is the `winrt::` namespace nitrogen puts the generated autolinking
       * `ReactPackageProvider` in, and the name of the generated MSBuild `.props` file.
       * It should match the `<RootNamespace>` of your `.vcxproj`.
       * @example `NitroTest`
       */
      windowsModuleName: z
        .string()
        .regex(safeNamePattern)
        .refine(isNotReservedKeyword, isReservedKeywordError),
    })
    .optional(),
  /**
   * Configures the code that gets generated for autolinking (registering)
   * Hybrid Object constructors.
   *
   * Each class listed here needs to have a default constructor/initializer
   * that takes zero arguments.
   */
  autolinking: z.record(z.string(), autolinkingHybridObjectSchema),
  /**
   * A list of paths relative to the project directory that should be ignored by nitrogen.
   * Nitrogen will not look for `.nitro.ts` files in these directories.
   */
  ignorePaths: z.array(z.string()).optional(),
  /**
   * Configures whether all nitro-generated files are marked as
   * [`linguist-generated`](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github)
   * for GitHub. This disables diffing for generated content and excludes them from language statistics.
   * This is controlled via `nitrogen/generated/.gitattributes`.
   */
  gitAttributesGeneratedFlag: z.boolean().optional().default(true),
})

/**
 * Represents the structure of a `nitro.json` config file.
 */
export type NitroUserConfig = z.infer<typeof NitroUserConfigSchema>
