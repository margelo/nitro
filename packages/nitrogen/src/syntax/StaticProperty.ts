import { Property } from './Property.js'
import { StaticMethod } from './StaticMethod.js'

/** A class property exposed through native static getter and setter functions. */
export class StaticProperty extends Property {
  getStaticMethods():
    | [getter: StaticMethod]
    | [getter: StaticMethod, setter: StaticMethod] {
    const methods = this.getCppMethods().map(
      (method) =>
        new StaticMethod(method.name, method.returnType, method.parameters, {
          generated: true,
        })
    )
    const getter = methods[0]!
    const setter = methods[1]
    return setter == null ? [getter] : [getter, setter]
  }
}
