import { type NitroConfig } from '../../config/NitroConfig.js'
import type { SwiftProtocolConformance } from 'nitro-core'
import type { Language } from '../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../c++/getForwardDeclaration.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

interface GetHybridObjectCodeOptions extends GetCodeOptions {
  mode?: 'strong' | 'weak'
}

export class HybridObjectType implements Type {
  readonly hybridObjectName: string
  readonly implementationLanguage: Language
  readonly baseTypes: HybridObjectType[]
  readonly sourceConfig: NitroConfig
  readonly swiftProtocolConformances: SwiftProtocolConformance[]

  constructor(
    hybridObjectName: string,
    implementationLanguage: Language,
    baseTypes: HybridObjectType[],
    sourceConfig: NitroConfig,
    swiftProtocolConformances?: SwiftProtocolConformance[]
  )
  constructor(spec: HybridObjectSpec)
  constructor(
    ...args:
      | [
          hybridObjectName: string,
          implementationLanguage: Language,
          baseTypes: HybridObjectType[],
          sourceConfig: NitroConfig,
          swiftProtocolConformances?: SwiftProtocolConformance[],
        ]
      | [HybridObjectSpec]
  ) {
    if (args.length === 1) {
      const [spec] = args

      this.hybridObjectName = spec.name
      this.implementationLanguage = spec.language
      this.sourceConfig = spec.config
      this.baseTypes = spec.baseTypes.map((b) => new HybridObjectType(b))
      this.swiftProtocolConformances =
        spec.language === 'swift' ? spec.protocolConformances : []
    } else {
      const [
        hybridObjectName,
        implementationLanguage,
        baseTypes,
        sourceConfig,
        swiftProtocolConformances = [],
      ] = args

      this.hybridObjectName = hybridObjectName
      this.implementationLanguage = implementationLanguage
      this.baseTypes = baseTypes
      this.sourceConfig = sourceConfig
      this.swiftProtocolConformances = swiftProtocolConformances
    }

    if (this.hybridObjectName.startsWith('__')) {
      throw new Error(
        `HybridObject name cannot start with two underscores (__)! (In ${this.hybridObjectName})`
      )
    }
  }

  get kind(): TypeKind {
    return 'hybrid-object'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, options: GetHybridObjectCodeOptions): string {
    const name = getHybridObjectName(this.hybridObjectName)
    const mode = options.mode ?? 'strong'
    const fullyQualified =
      options.fullyQualified ?? this.sourceConfig.isExternalConfig

    switch (language) {
      case 'c++': {
        const ptrType = mode === 'strong' ? 'std::shared_ptr' : 'std::weak_ptr'
        let typeName = name.HybridTSpec
        if (fullyQualified) {
          typeName = this.sourceConfig.getCxxNamespace('c++', name.HybridTSpec)
        }
        const type = `${ptrType}<${typeName}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift': {
        return `(any ${name.HybridTSpec})`
      }
      case 'kotlin': {
        if (fullyQualified) {
          // full qualified name: "com.margelo.nitro.image.Image"
          return this.sourceConfig.getAndroidPackage(
            'java/kotlin',
            name.HybridTSpec
          )
        } else {
          // "Image"
          return name.HybridTSpec
        }
      }
      default:
        throw new Error(
          `Language ${language} is not yet supported for HybridObjectType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return []
  }

  getCppHeader(): { name: string; space: 'user' | 'system' } {
    const { HybridTSpec } = getHybridObjectName(this.hybridObjectName)
    return this.sourceConfig.getCxxHeader(`${HybridTSpec}.hpp`)
  }

  getRequiredImports(language: Language): SourceImport[] {
    const name = getHybridObjectName(this.hybridObjectName)
    const cxxNamespace = this.sourceConfig.getCxxNamespace('c++')
    const imports: SourceImport[] = []

    switch (language) {
      case 'c++': {
        imports.push({
          language,
          declaration: { name: 'memory', space: 'system' },
        })
        imports.push({
          language,
          declaration: {
            forwardDeclaration: getForwardDeclaration(
              'class',
              name.HybridTSpec,
              cxxNamespace
            ),
          },
          implementation: this.getCppHeader(),
        })
        break
      }
      case 'kotlin': {
        if (this.sourceConfig.isExternalConfig) {
          imports.push({
            language,
            name: this.sourceConfig.getAndroidPackage(
              'java/kotlin',
              name.HybridTSpec
            ),
          })
        }
        break
      }
      case 'swift': {
        if (this.sourceConfig.isExternalConfig) {
          imports.push({
            language,
            name: this.sourceConfig.getIosModuleName(),
            access: 'public',
          })
        }
        break
      }
    }

    return imports
  }
}
