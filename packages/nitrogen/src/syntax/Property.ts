import type { CodeNode } from './CodeNode.js'
import { capitalizeName } from '../utils.js'
import { type SourceFile, type SourceImport } from './SourceFile.js'
import type { Language } from '../getPlatformSpecs.js'
import type { Type } from './types/Type.js'
import { Method } from './Method.js'
import { VoidType } from './types/VoidType.js'
import { Parameter } from './Parameter.js'

export interface PropertyBody {
  getter: string
  setter: string
}

export type LanguageEnvironment = 'jvm' | 'swift' | 'other'

// Kotlin only shortens accessors when `is` is not followed by a lowercase letter
// (see `JvmAbi.startsWithIsPrefix`), and it does that for every type - not just booleans.
function hasJvmIsPrefix(name: string): boolean {
  if (!name.startsWith('is') || name.length === 2) return false
  const next = name.charAt(2)
  return next < 'a' || next > 'z'
}

export interface PropertyModifiers {
  /**
   * The name of the class that defines this C++ property getter/setter method.
   * Example: `Person` -> `int Person::getAge()`
   */
  classDefinitionName?: string
  /**
   * Whether the property should be marked as inlineable.
   */
  inline?: boolean
  /*+
   * Whether the property is a pure virtual C++ property (getter + setter).
   */
  virtual?: boolean
  /**
   * Whether the property is marked as `noexcept` (doesn't throw) or not.
   */
  noexcept?: boolean
  /**
   * Whether this property overrides a base/super property.
   */
  override?: boolean
  /**
   * Whether this property has a `@DoNotStrip` and `@Keep` attribute to avoid
   * it from being stripped from the binary by the Java compiler or ProGuard.
   */
  doNotStrip?: boolean
}

export class Property implements CodeNode {
  readonly name: string
  readonly type: Type
  readonly isReadonly: boolean

  constructor(name: string, type: Type, isReadonly: boolean) {
    this.name = name
    this.type = type
    this.isReadonly = isReadonly
    if (this.name.startsWith('__')) {
      throw new Error(
        `Property names are not allowed to start with two underscores (__)! (In ${this.jsSignature})`
      )
    }
  }

  get jsSignature(): string {
    return `${this.name}: ${this.type.kind}`
  }

  getExtraFiles(): SourceFile[] {
    return this.type.getExtraFiles()
  }

  getRequiredImports(language: Language): SourceImport[] {
    return this.type.getRequiredImports(language)
  }

  getGetterName(environment: LanguageEnvironment): string {
    switch (environment) {
      case 'jvm':
        if (hasJvmIsPrefix(this.name)) {
          // isSomething -> isSomething()
          return this.name
        }
        break
      case 'swift':
        // Swift only shortens boolean accessors that start with "is" or "has"
        if (
          this.type.kind === 'boolean' &&
          (this.name.startsWith('is') || this.name.startsWith('has'))
        ) {
          // isSomething -> isSomething()
          return this.name
        }
        break
      default:
        break
    }
    // isSomething -> getIsSomething()
    return `get${capitalizeName(this.name)}`
  }

  getSetterName(environment: LanguageEnvironment): string {
    if (environment === 'jvm' && hasJvmIsPrefix(this.name)) {
      // isSomething -> setSomething()
      return `set${this.name.slice(2)}`
    }
    // isSomething -> setIsSomething()
    return `set${capitalizeName(this.name)}`
  }

  get cppGetter(): Method {
    return new Method(this.getGetterName('other'), this.type, [])
  }

  get cppSetter(): Method | undefined {
    if (this.isReadonly) return undefined
    const parameter = new Parameter(this.name, this.type)
    return new Method(this.getSetterName('other'), new VoidType(), [parameter])
  }

  getCppMethods(): [getter: Method] | [getter: Method, setter: Method] {
    if (this.cppSetter != null) {
      // get + set
      return [this.cppGetter, this.cppSetter]
    } else {
      // get
      return [this.cppGetter]
    }
  }

  getCode(
    language: Language,
    modifiers?: PropertyModifiers,
    body?: PropertyBody
  ): string {
    if (body != null) {
      body.getter = body.getter.trim()
      body.setter = body.setter.trim()
    }

    switch (language) {
      case 'c++': {
        const methods = this.getCppMethods()
        const [getter, setter] = methods
        const lines: string[] = []
        lines.push(getter.getCode('c++', modifiers, body?.getter))
        if (setter != null) {
          lines.push(setter.getCode('c++', modifiers, body?.setter))
        }

        return lines.join('\n')
      }
      case 'swift': {
        const type = this.type.getCode('swift')
        let accessors: string
        if (body == null) {
          accessors = this.isReadonly ? `get` : `get set`
        } else {
          const lines: string[] = []
          lines.push(`
get {
  ${body.getter}
}
          `)
          if (!this.isReadonly) {
            lines.push(`
set {
  ${body.setter}
}
            `)
          }
          accessors = '\n' + lines.join('\n') + '\n'
        }
        return `var ${this.name}: ${type} { ${accessors} }`
      }
      case 'kotlin': {
        const type = this.type.getCode('kotlin')
        let keyword = this.isReadonly ? 'val' : 'var'
        if (modifiers?.virtual) keyword = `abstract ${keyword}`
        const lines: string[] = []
        if (modifiers?.doNotStrip) {
          lines.push('@get:DoNotStrip', '@get:Keep')
          if (!this.isReadonly) {
            lines.push('@set:DoNotStrip', '@set:Keep')
          }
        }
        lines.push(`${keyword} ${this.name}: ${type}`)
        if (body != null) {
          lines.push(`
  get() {
    ${body.getter}
  }
          `)
          if (!this.isReadonly) {
            lines.push(`
  set(value) {
    ${body.setter}
  }
            `)
          }
        }
        return lines.join('\n')
      }
      default:
        throw new Error(
          `Language ${language} is not yet supported for properties!`
        )
    }
  }
}
