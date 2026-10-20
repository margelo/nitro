import { createSwiftConverter } from './SwiftConverter.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftHybridObjectType } from './types/SwiftHybridObjectType.js'
import { escapeCppName } from '../helpers.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { SwiftRetainedPointerType } from './types/SwiftRetainedPointerType.js'

export function getHybridObjectBridgeNames(type: HybridObjectType) {
  const strongPointerAlias = escapeCppName(
    type.getCode('c++', { context: 'value' })
  )
  const weakPointerAlias = escapeCppName(
    type.getCode('c++', { context: 'value', mode: 'weak' })
  )
  return {
    strong: strongPointerAlias,
    weak: weakPointerAlias,
    create: `create_${strongPointerAlias}`,
    get: `get_${strongPointerAlias}`,
    weakify: `weakify_${strongPointerAlias}`,
  }
}

export function createSwiftHybridObjectConverter(
  type: SwiftHybridObjectType
): SourceFile[] {
  const hybridObjectType = type.type
  const cppWrapperType = type.getCode('c++', { context: 'value' })
  const pointer = new SwiftRetainedPointerType(type)
  const getSwiftPartFunction = `${NitroConfig.current.getSwiftBridgeNamespace('c++')}::${getHybridObjectBridgeNames(hybridObjectType).get}`
  const cppHybridObjectConverter = `JSIConverter<${hybridObjectType.getCode('c++', { context: 'type-argument', fullyQualified: true })}>`
  const jsToSwiftValue = pointer.take(
    'c++',
    `${getSwiftPartFunction}(hybridSpec)`
  )
  const cppToSwiftValue = pointer.take('c++', `${getSwiftPartFunction}(value)`)
  const jsToSwiftConverterCode = `
auto hybridSpec = ${cppHybridObjectConverter}::fromJSI(runtime, value);
return ${jsToSwiftValue};
`.trim()
  // TODO: Call value.getCxxPart() once borrowing class methods export as const:
  // https://github.com/swiftlang/swift/pull/92862
  const swiftToJSConverterCode = `
auto hybridSpec = ${cppWrapperType}::getCxxPart(value);
return ${cppHybridObjectConverter}::toJSI(runtime, hybridSpec);
`.trim()
  const swiftToCppConverterCode = 'return SwiftType::getCxxPart(value);'
  const cppToSwiftConverterCode = `return ${cppToSwiftValue};`
  const jsCanConvertCode = `return ${cppHybridObjectConverter}::canConvert(runtime, value);`
  return createSwiftConverter({
    name: type.name,
    cppType: hybridObjectType,
    swiftType: type,
    forwardDeclaration: type.forwardDeclaration,
    fromSwift: swiftToCppConverterCode,
    toSwift: cppToSwiftConverterCode,
    fromJSI: jsToSwiftConverterCode,
    toJSI: swiftToJSConverterCode,
    canConvert: jsCanConvertCode,
  })
}
