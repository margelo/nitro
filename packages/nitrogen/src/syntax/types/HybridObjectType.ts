import { type NitroConfig } from '../../config/NitroConfig.js'
import type { HybridObjectPlatforms, Language } from '../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../c++/getForwardDeclaration.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export interface GetHybridObjectCodeOptions extends GetCodeOptions {
  mode?: 'strong' | 'weak'
}

export class HybridObjectType implements Type {
  readonly hybridObjectName: string
  readonly platforms: HybridObjectPlatforms
  readonly baseTypes: HybridObjectType[]
  readonly sourceConfig: NitroConfig

  constructor(hybridObjectName: string, platforms: HybridObjectPlatforms, baseTypes: HybridObjectType[], sourceConfig: NitroConfig)
  constructor(spec: HybridObjectSpec)
  constructor(
    ...args:
      | [hybridObjectName: string, platforms: HybridObjectPlatforms, baseTypes: HybridObjectType[], sourceConfig: NitroConfig]
      | [HybridObjectSpec]
  ) {
    if (args.length === 1) {
      const [spec] = args

      this.hybridObjectName = spec.name
      this.platforms = spec.platforms
      this.sourceConfig = spec.config
      this.baseTypes = spec.baseTypes.map((b) => new HybridObjectType(b))
    } else {
      const [hybridObjectName, platforms, baseTypes, sourceConfig] = args

      this.hybridObjectName = hybridObjectName
      this.platforms = platforms
      this.baseTypes = baseTypes
      this.sourceConfig = sourceConfig
    }

    if (this.hybridObjectName.startsWith('__')) {
      throw new Error(`HybridObject name cannot start with two underscores (__)! (In ${this.hybridObjectName})`)
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
    const fullyQualified = options.fullyQualified ?? this.sourceConfig.isExternalConfig

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
        const apple = this.platforms.apple
        if (apple == null) {
          throw new Error(
            `HybridObject "${this.hybridObjectName}" is not implemented on Apple platforms and cannot be referenced from Swift.`
          )
        }
        if (apple.language !== 'swift') {
          throw new Error(
            `HybridObject "${this.hybridObjectName}" is implemented in ${apple.language} on Apple platforms, but this reference requires Swift. Cross-language HybridObject references are currently supported only in C++ APIs.`
          )
        }
        return `(any ${name.HybridTSpec})`
      }
      case 'kotlin': {
        const android = this.platforms.android
        if (android == null) {
          throw new Error(`HybridObject "${this.hybridObjectName}" is not implemented on Android and cannot be referenced from Kotlin.`)
        }
        if (android.language !== 'kotlin') {
          throw new Error(
            `HybridObject "${this.hybridObjectName}" is implemented in ${android.language} on Android, but this reference requires Kotlin. Cross-language HybridObject references are currently supported only in C++ APIs.`
          )
        }
        if (fullyQualified) {
          // full qualified name: "com.margelo.nitro.image.Image"
          return this.sourceConfig.getAndroidPackage('java/kotlin', name.HybridTSpec)
        } else {
          // "Image"
          return name.HybridTSpec
        }
      }
      default:
        throw new Error(`Language ${language} is not yet supported for HybridObjectType!`)
    }
  }
  getExtraFiles(): SourceFile[] {
    return []
  }

  getCppHeader(): { header: string; space: 'user' | 'system' } {
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
          declaration: { header: 'memory', space: 'system' },
        })
        imports.push({
          language,
          declaration: {
            forwardDeclaration: getForwardDeclaration('class', name.HybridTSpec, cxxNamespace),
          },
          implementation: this.getCppHeader(),
        })
        break
      }
      case 'kotlin': {
        if (this.sourceConfig.isExternalConfig) {
          imports.push({
            language,
            name: this.sourceConfig.getAndroidPackage('java/kotlin', name.HybridTSpec),
          })
        }
        break
      }
      case 'swift': {
        if (this.sourceConfig.isExternalConfig) {
          imports.push({
            language,
            name: this.sourceConfig.getAppleModuleName(),
            access: 'public',
          })
        }
        break
      }
    }

    return imports
  }
}
