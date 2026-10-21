import { Node } from 'ts-morph'
import type { Language } from '../getPlatformSpecs.js'

export interface Documentation {
  readonly text: string
  readonly deprecated?: string
}

export function getDocumentation(node: Node | undefined): Documentation | undefined {
  if (!Node.isJSDocable(node)) return undefined
  const comments = node.getJsDocs()
  const text = comments
    .map((comment) => comment.getInnerText().trim())
    .filter(Boolean)
    .join('\n\n')
  if (text.length === 0) return undefined
  const deprecatedTag = comments.flatMap((comment) => comment.getTags()).find((tag) => tag.getTagName() === 'deprecated')
  let deprecated: string | undefined
  if (deprecatedTag != null) {
    deprecated = deprecatedTag.getCommentText()?.trim() || 'Deprecated.'
  }
  return { text: text, deprecated: deprecated }
}

interface DocumentedCodeOptions {
  code: string
  documentation: Documentation | undefined
  language: Language
  emitDeprecation?: boolean
}

/** Apply source docs to public requirements, without annotating bridge helpers. */
export function withDocumentation({ code, documentation, language, emitDeprecation = true }: DocumentedCodeOptions): string {
  if (documentation == null) return code
  const commentText = Array.from(documentation.text, (character) => {
    const value = character.charCodeAt(0)
    const isControl = value < 0x20 || value === 0x7f
    const isWhitespace = character === '\t' || character === '\n' || character === '\r'
    if (isControl && !isWhitespace) return `&#${value};`
    return character
  }).join('')
  const commentLines = commentText.split(/\r\n?|\n|\u2028|\u2029/)
  const sections: string[] = []
  switch (language) {
    case 'swift':
      sections.push(commentLines.map((line) => `/// ${line}`).join('\n'))
      break
    case 'c++': {
      // A trailing backslash would splice the following declaration into this comment.
      const lines = commentLines.map((line) => `/// ${line.replace(/\\(\s*)$/, '&#92;$1')}`)
      sections.push(lines.join('\n'))
      break
    }
    case 'kotlin': {
      // Kotlin nests block comments, including comment-like text in examples.
      const lines = commentLines.map((line) => ` * ${line.replaceAll('/*', '/&#42;').replaceAll('*/', '*&#47;')}`)
      sections.push(
        `
/**
${lines.join('\n')}
 */
`.trim()
      )
      break
    }
  }
  if (emitDeprecation && documentation.deprecated != null) {
    switch (language) {
      case 'swift': {
        const message = getStringLiteral(documentation.deprecated, language)
        sections.push(
          `
@available(*, deprecated, message: ${message})
`.trim()
        )
        break
      }
      case 'kotlin': {
        const message = getStringLiteral(documentation.deprecated, language)
        sections.push(
          `
@Deprecated(${message})
`.trim()
        )
        break
      }
      case 'c++':
        // Registrations take addresses of these members. Keep their docs without
        // producing deprecation warnings in generated C++ plumbing.
        break
    }
  }
  sections.push(code)
  return sections.join('\n')
}

function getStringLiteral(value: string, language: 'swift' | 'kotlin'): string {
  const characters: string[] = []
  for (const character of value) {
    switch (character) {
      case '\\':
        characters.push('\\\\')
        break
      case '"':
        characters.push('\\"')
        break
      case '\n':
        characters.push('\\n')
        break
      case '\r':
        characters.push('\\r')
        break
      case '\t':
        characters.push('\\t')
        break
      case '$':
        characters.push(language === 'kotlin' ? '\\$' : '$')
        break
      default: {
        const code = character.charCodeAt(0)
        if (code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029) {
          const hex = code.toString(16)
          const escaped = language === 'swift' ? `\\u{${hex}}` : `\\u${hex.padStart(4, '0')}`
          characters.push(escaped)
        } else {
          characters.push(character)
        }
      }
    }
  }
  return `"${characters.join('')}"`
}
