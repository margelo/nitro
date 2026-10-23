import type { GetCodeOptions, TypeContext } from '../../types/Type.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import { escapeCppName } from '../../helpers.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { getClangImporterReferenceName, getQualifiedSwiftName, type ImportedCxxRecord } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

/** A result introduced when lowering a Swift method, accessor or callback. */
export class SwiftResultType implements SwiftType {
  constructor(
    readonly payload: SwiftType,
    readonly sourceConfig = NitroConfig.current,
    private readonly swiftNamespace = sourceConfig.getSwiftBridgeNamespace('swift')
  ) {}

  readonly kind = 'swift-result'
  readonly isEquatable = false
  readonly isHashable = false
  readonly isSendable = false
  readonly canImportFromCpp = true
  readonly isReferenceType = false
  readonly requiresSwiftGenericContext = true
  get containsSwiftGenerics(): boolean {
    return this.payload.containsSwiftGenerics
  }
  readonly needsSwiftConversion = false
  readonly requiresExplicitSwiftTarget = false
  fromSwift(value: string): string {
    return value
  }
  toSwift(value: string): string {
    return value
  }

  get specializationName(): string {
    return `Result_${escapeCppName(this.payload.getCode('c++', { context: 'type-argument' }))}`
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const payload = this.payload.getCode(language, {
          ...options,
          context: 'type-argument',
        })
        const owner = this.sourceConfig.getSwiftBridgeNamespace('c++')
        const type = `Result<${payload}, ${owner}::ResultTag>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return `${this.swiftNamespace}.${this.specializationName}`
      default:
        throw new Error(`Swift results cannot be represented in ${language}`)
    }
  }

  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  get importedCxxRecord(): ImportedCxxRecord {
    const payload = this.payload.getClangImporterName('type-argument')
    const owner = this.sourceConfig.getSwiftBridgeNamespace('swift')
    return {
      namespaces: ['margelo', 'nitro'],
      swiftName: `Result<${payload}, ${owner}.ResultTag>`,
      identifier: this.specializationName,
    }
  }
  getClangImporterName(context: TypeContext): string {
    const name = getQualifiedSwiftName(this.importedCxxRecord)
    return getClangImporterReferenceName(name, context)
  }

  get requiredCppHelpers(): CppHelper[] {
    const resultTagCode = `
// Distinct specializations prevent duplicate Swift metadata across module headers.
struct ResultTag {};
`.trim()
    const resultAliasCode = `
using ${this.specializationName} = ${this.getCode('c++', { context: 'value' })};
`.trim()
    return [
      ...this.payload.requiredCppHelpers,
      {
        header: {
          code: resultTagCode,
          requiredImports: [],
        },
      },
      {
        header: {
          code: resultAliasCode,
          requiredImports: this.getRequiredImports('c++', 'declaration'),
        },
      },
    ]
  }

  getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push(
          {
            language: language,
            declaration: {
              header: 'NitroModules/Result.hpp',
              space: 'system',
            },
          },
          ...this.payload.getRequiredImports(language, context)
        )
        break
      case 'swift':
        imports.push({
          language: language,
          name: `${this.sourceConfig.getAppleModuleName()}AppleCxx`,
          access: 'internal',
        })
        break
    }
    return imports
  }
  getExtraFiles(): SourceFile[] {
    return []
  }

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }
}
