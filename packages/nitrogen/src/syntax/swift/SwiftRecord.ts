import { createSwiftConverter } from './SwiftConverter.js'
import { indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftRecordType } from './types/SwiftRecordType.js'
import { getImportsCode } from '../getImportCode.js'
import {
  getProtocolConformanceImports,
  getSwiftImports,
} from './getSwiftImports.js'

export function createSwiftRecordBridge(type: SwiftRecordType): SourceFile[] {
  const swiftStructName = type.name
  const conformances = type.getProtocolConformances()
  const protocolNames = conformances.map((conformance) => conformance.name)
  const conformancePrefix = protocolNames.length > 0 ? ': ' : ''
  const swiftKeyType = type.keyType
  const swiftValueType = type.valueType
  const swiftDictionaryType = type.type.getCode('swift', {
    context: 'property',
  })
  const swiftImports = getImportsCode([
    ...getProtocolConformanceImports(conformances),
    ...getSwiftImports([type.type, swiftKeyType, swiftValueType], 'public'),
    { language: 'swift', name: 'NitroModules', access: 'internal' },
    { language: 'swift', name: 'CxxStdlib', access: 'internal' },
  ])
  const enumerateBody = `
guard let entry = iterator.next() else {
  return false
}
key = ${swiftKeyType.fromSwift('entry.key')}
value = .some(${swiftValueType.fromSwift('entry.value')})
return true
`.trim()
  const swiftFile: SourceFile = {
    name: `${swiftStructName}.swift`,
    language: 'swift',
    platform: 'ios',
    subdirectory: [],
    content: `
${createFileMetadataString(`${swiftStructName}.swift`)}

${swiftImports}

@_expose(Cxx)
public struct ${swiftStructName}${conformancePrefix}${protocolNames.join(', ')} {
  private var storage: ${swiftDictionaryType}
  public var dictionary: ${swiftDictionaryType} { storage }

  public init(_ dictionary: ${swiftDictionaryType}) {
    self.storage = dictionary
  }
  public init(minimumCapacity: Int) {
    self.storage = .init(minimumCapacity: minimumCapacity)
  }

  public mutating func set(key: ${swiftKeyType.getCode('swift', { context: 'property' })}, value: ${swiftValueType.getCode('swift', { context: 'property' })}) {
    storage.updateValue(${swiftValueType.toSwift('value')}, forKey: ${swiftKeyType.toSwift('key')})
  }

  public borrowing func makeCursor() -> Cursor {
    return Cursor(storage)
  }

  public struct Cursor {
    private var iterator: ${swiftDictionaryType}.Iterator

    fileprivate init(_ dictionary: ${swiftDictionaryType}) {
      self.iterator = dictionary.makeIterator()
    }

    // Optional output slots also support values without a default initializer.
    public mutating func next(key: inout ${swiftKeyType.getCode('swift', { context: 'property' })}?, value: inout ${swiftValueType.getCode('swift', { context: 'property' })}?) -> Bool {
      ${indent(enumerateBody, '      ')}
    }
  }
}
`.trim(),
  }
  const jsiDictionaryConverter = `SwiftDictionaryJSIConverter<${type.getCode('c++', { context: 'type-argument' })}, ${swiftKeyType.getCode('c++', { context: 'type-argument' })}, ${swiftValueType.getCode('c++', { context: 'type-argument' })}>`
  const cppDictionaryType = type.type.getCode('c++', {
    context: 'type-argument',
    fullyQualified: true,
  })
  const nativeDictionaryConverter = `SwiftDictionaryConverter<${cppDictionaryType}, SwiftType, ${swiftKeyType.getCode('c++', { context: 'type-argument' })}, ${swiftValueType.getCode('c++', { context: 'type-argument' })}>`
  const swiftToCppConverterCode = `return ${nativeDictionaryConverter}::fromSwift(value);`
  const cppToSwiftConverterCode = `return ${nativeDictionaryConverter}::toSwift(value);`
  const jsToSwiftConverterCode = `return ${jsiDictionaryConverter}::fromJSI(runtime, value);`
  const swiftToJSConverterCode = `return ${jsiDictionaryConverter}::toJSI(runtime, value);`
  const jsCanConvertCode = `return ${jsiDictionaryConverter}::canConvert(runtime, value);`
  return [
    swiftFile,
    ...createSwiftConverter({
      name: type.name,
      cppType: type.type,
      swiftType: type,
      forwardDeclaration: type.forwardDeclaration,
      fromSwift: swiftToCppConverterCode,
      toSwift: cppToSwiftConverterCode,
      imports: [
        {
          language: 'c++',
          declaration: {
            name: 'NitroModules/SwiftConverter+Dictionary.hpp',
            space: 'system',
          },
        },
        {
          language: 'c++',
          declaration: {
            name: 'NitroModules/JSIConverter+SwiftDictionary.hpp',
            space: 'system',
          },
        },
      ],
      fromJSI: jsToSwiftConverterCode,
      toJSI: swiftToJSConverterCode,
      canConvert: jsCanConvertCode,
    }),
  ]
}
