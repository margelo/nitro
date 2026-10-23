import type { Language } from '../../getPlatformSpecs.js'
import { escapeCppName } from '../helpers.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, NamedType, Type, TypeKind } from './Type.js'

export interface GetCallbackCodeOptions extends GetCodeOptions {
  includeNameInfo?: boolean
}

export class CallbackType implements Type {
  readonly returnType: Type
  readonly parameters: NamedType[]
  /** Whether the spec declares this callback as `Inline<...>`. */
  readonly isInline: boolean

  constructor(returnType: Type, parameters: NamedType[], isInline = false) {
    this.returnType = returnType
    this.parameters = parameters
    this.isInline = isInline
  }

  get specializationName(): string {
    return (
      'Callback_' +
      [this.returnType, ...this.parameters].map((p) => escapeCppName(p.getCode('c++', { context: 'type-argument' }))).join('_')
    )
  }

  get jsName(): string {
    const paramsJs = this.parameters.map((p) => `${p.name}: ${p.kind}`).join(', ')
    const returnType = this.returnType.getCode('c++', { context: 'return' })
    return `(${paramsJs}) => ${returnType}`
  }

  get kind(): TypeKind {
    return 'callback'
  }
  get isEquatable(): boolean {
    return false
  }

  /**
   * An `Inline<...>` callback is only borrowed as the parameter it is declared as.
   * Other contexts, such as the result of `escape()`, use the owning `Callback`.
   */
  protected isBorrowed(options: GetCodeOptions): boolean {
    if (!this.isInline) return false
    return options.context === 'parameter' || options.context === 'parameter-type'
  }

  getCode(language: Language, options: GetCallbackCodeOptions): string {
    const includeNameInfo = options.includeNameInfo ?? true
    const isBorrowed = this.isBorrowed(options)
    switch (language) {
      case 'c++': {
        const params = this.parameters
          .map((p) => {
            const code = p.getCode('c++', {
              ...options,
              context: 'parameter',
            })
            if (includeNameInfo) return `${code} /* ${p.name} */`
            else return code
          })
          .join(', ')
        const returnType = this.returnType.getCode(language, {
          ...options,
          context: 'return',
        })
        const name = isBorrowed ? 'InlineCallback' : 'Callback'
        const qualifiedName = options.fullyQualified ? `margelo::nitro::${name}` : name
        const type = `${qualifiedName}<${returnType}(${params})>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift': {
        const params = this.parameters
          .map((p) => {
            const code = p.getCode(language, {
              ...options,
              context: 'type-argument',
            })
            if (includeNameInfo) return `/* ${p.escapedName} */ ${code}`
            else return code
          })
          .join(', ')
        const returnType = this.returnType.getCode(language, {
          ...options,
          context: 'type-argument',
        })
        if (isBorrowed) {
          const type = `some InlineCallback<(${params}), ${returnType}> & ~Copyable & ~Escapable`
          return options.context === 'parameter' ? `borrowing ${type}` : type
        }
        return `any Callback<(${params}), ${returnType}>`
      }
      case 'kotlin': {
        const params = this.parameters
          .map((p) => {
            const code = p.getCode(language, {
              ...options,
              context: 'parameter',
            })
            if (includeNameInfo) return `${p.escapedName}: ${code}`
            else return code
          })
          .join(', ')
        const returnType = this.returnType.getCode(language, {
          ...options,
          context: 'return',
        })
        return `Callback<(${params}) -> ${returnType}>`
      }
      default:
        throw new Error(`Language ${language} is not yet supported for CallbackType!`)
    }
  }
  getExtraFiles(): SourceFile[] {
    return [...this.returnType.getExtraFiles(), ...this.parameters.flatMap((p) => p.getExtraFiles())]
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = [
      ...this.returnType.getRequiredImports(language),
      ...this.parameters.flatMap((p) => p.getRequiredImports(language)),
    ]
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { header: 'NitroModules/Callback.hpp', space: 'system' },
        })
        if (this.isInline) {
          imports.push({
            language,
            declaration: {
              header: 'NitroModules/InlineCallback.hpp',
              space: 'system',
            },
          })
        }
        imports.push({
          language,
          declaration: { header: 'functional', space: 'system' },
        })
        break
      case 'swift':
        imports.push({
          language,
          name: 'NitroModules',
          access: 'public',
        })
        break
      case 'kotlin':
        imports.push({
          language,
          name: 'com.margelo.nitro.core.Callback',
        })
        break
    }
    return imports
  }
}
