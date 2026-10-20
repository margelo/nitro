import type { Language } from '../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../c++/getForwardDeclaration.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class AnyHybridObjectType implements Type {
  constructor() {}

  get kind(): TypeKind {
    return 'hybrid-object-base'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = `std::shared_ptr<HybridObject>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      default:
        throw new Error(
          `\`AnyHybridObject\` cannot be used directly in ${language} yet. Use a specific derived class of \`HybridObject\` instead!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return []
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push(
          {
            language,
            declaration: { name: 'memory', space: 'system' },
          },
          {
            language,
            declaration: {
              forwardDeclaration: getForwardDeclaration(
                'class',
                'HybridObject',
                'margelo::nitro'
              ),
            },
            implementation: {
              name: `NitroModules/HybridObject.hpp`,
              space: 'system',
            },
          }
        )
        break
    }
    return imports
  }
}
