import { indent } from '../../utils.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { OptionalType } from '../types/OptionalType.js'
import type { Type } from '../types/Type.js'
import type { VariantType } from '../types/VariantType.js'

function isPrimitive(type: Type): boolean {
  switch (type.kind) {
    case 'int64':
    case 'uint64':
    case 'boolean':
    case 'number':
    case 'string':
    case 'void':
    case 'result-wrapper':
    case 'null':
    case 'error':
      return true
    case 'optional':
      const optional = getTypeAs(type, OptionalType)
      return isPrimitive(optional.wrappingType)
    default:
      return false
  }
}

export function createSwiftVariant(variant: VariantType): SourceFile {
  const typename = variant.getAliasName('swift')
  const cases = variant.cases
    .map(([label, v]) => {
      const type = v.getCode('swift')
      return `case ${label}(${type})`
    })
    .join('\n')
  const asCases = variant.cases
    .map(([label]) => {
      return `case .${label}(let value): return value as? T`
    })
    .join('\n')

  const jsSignature = variant.variants.map((t) => t.kind).join(' | ')

  const allPrimitives = variant.variants.every((v) => isPrimitive(v))
  const enumDeclaration = allPrimitives ? 'enum' : 'indirect enum'

  const extraImports = variant.variants
    .flatMap((t) => t.getRequiredImports('swift'))
    .map((i) => `import ${i.name}`)
    .filter(isNotDuplicate)

  const code = `
${createFileMetadataString(`${typename}.swift`)}

${extraImports.join('\n')}

/**
 * An Swift enum with associated values representing a Variant/Union type.
 * JS type: \`${jsSignature}\`
 */
@frozen
public ${enumDeclaration} ${typename} {
  ${indent(cases, '  ')}
}

public extension ${typename} {
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
    name: `${typename}.swift`,
    platform: 'ios',
    subdirectory: [],
  }
}
