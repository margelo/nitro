import { indent } from '../../utils.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { DiscriminatedUnionType } from '../types/DiscriminatedUnionType.js'

/**
 * Generates a Swift @frozen enum with cases named after the discriminant values.
 * Much more ergonomic than positional `first`/`second` labels from VariantType.
 *
 * E.g. `Vehicle` with discriminant `kind: 'truck' | 'boat'` becomes:
 * ```swift
 * @frozen public enum Vehicle {
 *   case truck(Truck)
 *   case boat(Boat)
 * }
 * ```
 */
export function createSwiftDiscriminatedUnion(
  union: DiscriminatedUnionType
): SourceFile {
  const { unionName, discriminantKey, variants } = union

  const cases = variants
    .map((v) => {
      const caseName = v.discriminantValue.replace(/[^a-zA-Z0-9_]/g, '_')
      return `case ${caseName}(${v.type.getCode('swift')})`
    })
    .join('\n')

  const asCases = variants
    .map((v) => {
      const caseName = v.discriminantValue.replace(/[^a-zA-Z0-9_]/g, '_')
      return `case .${caseName}(let value): return value as? T`
    })
    .join('\n')

  const jsSignature = variants
    .map((v) => `{ ${discriminantKey}: '${v.discriminantValue}', ... }`)
    .join(' | ')

  const extraImports = variants
    .flatMap((v) => v.type.getRequiredImports('swift'))
    .map((i) => `import ${i.name}`)
    .filter(isNotDuplicate)

  const code = `
${createFileMetadataString(`${unionName}.swift`)}

${extraImports.join('\n')}

/**
 * A Swift enum representing a discriminated union, keyed on "${discriminantKey}".
 * JS type: \`${jsSignature}\`
 */
@frozen
public indirect enum ${unionName} {
  ${indent(cases, '  ')}
}

public extension ${unionName} {
  func asType<T>(_ type: T.Type = T.self) -> T? {
    switch self {
      ${indent(asCases, '      ')}
    }
  }
  func isType<T>(_ type: T.Type = T.self) -> Bool {
    return self.asType(type) != nil
  }
}
  `.trim()

  return {
    content: code,
    language: 'swift',
    name: `${unionName}.swift`,
    platform: 'ios',
    subdirectory: [],
  }
}
