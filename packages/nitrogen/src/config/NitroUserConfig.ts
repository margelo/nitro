import { z } from 'zod'

// Namespaces and package names in C++/Java will be matched with a regex.
const safeNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const isNotReservedKeyword = (val: string) => !['nitro', 'NitroModules'].includes(val)
const isReservedKeywordError = {
  message: `This value is reserved and cannot be used!`,
}

export const NitroUserConfigSchema = z.object({
  /**
   * Selects the package imported by generated JavaScript runtime modules.
   * React Native uses `react-native-nitro-modules`; bare uses `nitro-core`.
   */
  environment: z.enum(['react-native', 'bare']).default('react-native'),
  /**
   * Represents the C++ namespace of the module that will be generated.
   *
   * This can have multiple sub-namespaces, and is always relative to `margelo::nitro`.
   * @example `['image']` -> `margelo::nitro::image`
   */
  cxxNamespace: z.array(z.string().regex(safeNamePattern).refine(isNotReservedKeyword, isReservedKeywordError)).min(1),
  /**
   * Apple specific options, for iOS, macOS, tvOS and visionOS.
   */
  apple: z.object({
    /**
     * Represents the Apple module name of the module that will be generated.
     *
     * This will be used to generate Swift bridges, as those are always namespaced within the clang module.
     *
     * Use the same name in the library's `swiftpmConfig` in package.json.
     * @example `NitroTest`
     */
    moduleName: z.string().regex(safeNamePattern).refine(isNotReservedKeyword, isReservedKeywordError),
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
    namespace: z.array(z.string().regex(safeNamePattern).refine(isNotReservedKeyword, isReservedKeywordError)).min(1),

    /**
     * Represents the name of the Android C++ library (aka name in CMakeLists.txt `add_library(..)`).
     * This will be loaded via `System.loadLibrary(...)`.
     * @example `NitroTest`
     */
    cxxLibName: z.string().regex(safeNamePattern).refine(isNotReservedKeyword, isReservedKeywordError),
  }),
  /**
   * A list of paths relative to the project directory that should be ignored by nitrogen.
   * Nitrogen will not look for `.nitro.ts` specs in these paths.
   */
  ignorePaths: z.array(z.string()).optional(),
  /** Removed in favor of implementation and constructor declarations in .nitro.ts. */
  autolinking: z
    .never({
      error: 'autolinking has moved to .nitro.ts: declare implementation in each platform and a public constructor to enable new.',
    })
    .optional(),
})

/**
 * Represents the structure of a `nitro.json` config file.
 */
export type NitroUserConfig = z.infer<typeof NitroUserConfigSchema>
