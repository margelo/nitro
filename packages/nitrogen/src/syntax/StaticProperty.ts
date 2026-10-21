import type { Language } from '../getPlatformSpecs.js'
import { Property, type PropertyBody, type PropertyModifiers } from './Property.js'
import { StaticMethod } from './StaticMethod.js'

/** A class property exposed through native static getter and setter functions. */
export class StaticProperty extends Property {
  override getCode(language: Language, modifiers?: PropertyModifiers, body?: PropertyBody): string {
    const declaration = super.getCode(language, modifiers, body)
    switch (language) {
      case 'swift':
        return `static ${declaration}`
      case 'c++':
      case 'kotlin':
        return declaration
    }
  }

  getStaticMethods(): [getter: StaticMethod] | [getter: StaticMethod, setter: StaticMethod] {
    const methods = this.getCppMethods().map(
      (method) =>
        new StaticMethod(method.name, method.returnType, method.parameters, {
          documentation: method.documentation,
          generated: true,
        })
    )
    const getter = methods[0]!
    const setter = methods[1]
    return setter == null ? [getter] : [getter, setter]
  }
}
