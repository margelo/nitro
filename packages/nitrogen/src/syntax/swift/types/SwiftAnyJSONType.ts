import type { GetCodeOptions, TypeContext } from '../../types/Type.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceImport } from '../../SourceFile.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { AnyJSONType } from '../../types/AnyJSONType.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

export class SwiftAnyJSONType extends AnyJSONType implements SwiftType {
  readonly isHashable = true
  readonly isSendable = true

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }

  get isReferenceType(): boolean {
    return false
  }
  readonly requiresSwiftGenericContext = false
  get containsSwiftGenerics(): boolean {
    return false
  }

  get canImportFromCpp(): boolean {
    return false
  }

  readonly needsSwiftConversion = false
  readonly requiresExplicitSwiftTarget = false
  fromSwift(value: string): string {
    return value
  }
  toSwift(value: string): string {
    return value
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = 'NitroModules::AnyJSON'
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      default:
        return super.getCode(language, options)
    }
  }

  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(context: TypeContext): string {
    return getClangImporterReferenceName('NitroModules.AnyJSON', context)
  }

  get requiredCppHelpers(): CppHelper[] {
    return []
  }

  override getRequiredImports(
    language: Language,
    context: 'declaration' | 'implementation' = 'implementation'
  ): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: {
            forwardDeclaration: 'namespace NitroModules { class AnyJSON; }',
          },
          implementation: {
            name: 'NitroModules/NitroModules-Swift-Cxx-Umbrella.hpp',
            space: 'system',
          },
        })
        if (context === 'implementation') {
          imports.push({
            language,
            declaration: {
              name: 'NitroModules/JSIConverter+SwiftAnyJSON.hpp',
              space: 'system',
            },
          })
        }
        break
      case 'swift':
      case 'kotlin':
        imports.push(...super.getRequiredImports(language))
        break
    }
    return imports
  }
}
