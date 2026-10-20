import type { NitroConfig } from '../config/NitroConfig.js'
import type {
  HybridObjectPlatformOptions,
  Language,
} from '../getPlatformSpecs.js'
import type { InstanceMethod } from './InstanceMethod.js'
import type { Property } from './Property.js'
import type { Constructor } from './Constructor.js'
import type { StaticMethod } from './StaticMethod.js'
import type { StaticProperty } from './StaticProperty.js'

type LanguagePlatformOptions<L extends Language> = Extract<
  HybridObjectPlatformOptions,
  { language: L }
>

/** Options that only some languages support. */
interface NativeLanguageSpecs {
  'c++': {}
  'swift': Pick<LanguagePlatformOptions<'swift'>, 'protocolConformances'>
  'kotlin': Pick<LanguagePlatformOptions<'kotlin'>, 'implementedInterfaces'>
}

type NativePlatformSpec<L extends Language> = L extends Language
  ? {
      language: L
      implementation?: LanguagePlatformOptions<L>['implementation']
    } & NativeLanguageSpecs[L]
  : never

export type HybridObjectSpec<L extends Language = Language> =
  NativePlatformSpec<L> & {
    name: string
    isHybridView: boolean
    allowMultipleImplementations: boolean
    allowInheritance: boolean
    properties: Property[]
    methods: InstanceMethod[]
    constructor?: Constructor
    staticMethods: StaticMethod[]
    staticProperties: StaticProperty[]
    baseTypes: HybridObjectSpec[]
    config: NitroConfig
  }
