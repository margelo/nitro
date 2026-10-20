import { readFile, writeFile } from 'fs/promises'
import {
  QuoteKind,
  ts,
  type ImportDeclaration,
  type Node,
  type SourceFile,
} from 'ts-morph'
import {
  getHybridClassReExports,
  RUNTIME_IMPORT_PREFIX,
  type HybridClassReExport,
} from './hybridClassReExports.js'

const BYTE_ORDER_MARK = '\uFEFF'
// An ECMAScript identifier, e.g. `Image` but not `Image.cjs` or `sub/Image`.
const IDENTIFIER_PATTERN = /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u

/** A spec file and the HybridObject classes it declares. */
export interface HybridClassSpecFile {
  sourceFile: SourceFile
  classNames: string[]
}

/**
 * Returns errors for `#nitro/*` re-exports that do not name a HybridObject
 * class declared in the spec.
 */
export function getHybridClassReExportErrors({
  sourceFile,
  classNames,
}: HybridClassSpecFile): Error[] {
  const unmatchedReExports = getHybridClassReExports(sourceFile).filter(
    (reExport) => !classNames.includes(reExport.className)
  )
  return unmatchedReExports.map((reExport) => {
    const line = reExport.declaration.getStartLineNumber()
    const message = getUnmatchedReExportMessage(sourceFile, reExport)
    return new Error(`${sourceFile.getFilePath()}:${line}: ${message}`)
  })
}

function getUnmatchedReExportMessage(
  sourceFile: SourceFile,
  { declaration, specifier, className }: HybridClassReExport
): string {
  const code = declaration.getText()
  if (!IDENTIFIER_PATTERN.test(className)) {
    let reason: string
    if (className.length === 0) {
      reason = `the specifier \`${specifier.getLiteralValue()}\` names no class`
    } else {
      reason = `\`${className}\` is not a class name`
    }
    return (
      `\`${code}\` is not a valid \`${RUNTIME_IMPORT_PREFIX}\` re-export, because ${reason}. ` +
      `Remove it, and Nitrogen adds \`export * from '${RUNTIME_IMPORT_PREFIX}<ClassName>'\` for each HybridObject class.`
    )
  }
  if (sourceFile.getClass(className) != null) {
    return (
      `\`${code}\` has no matching HybridObject class in this file. ` +
      `\`${className}\` is declared here but does not extend HybridObject.`
    )
  }
  return (
    `\`${code}\` has no matching HybridObject class in this file. ` +
    `Remove it, or declare \`export declare class ${className} extends HybridObject\` in this file.`
  )
}

/**
 * Adds `export * from '#nitro/<ClassName>'` for each class the spec does not
 * re-export yet, and returns the added lines.
 */
export async function addMissingHybridClassReExports({
  sourceFile,
  classNames,
}: HybridClassSpecFile): Promise<string[]> {
  const reExports = getHybridClassReExports(sourceFile)
  const exportedNames = reExports.map((reExport) => reExport.className)
  const missingNames = classNames.filter(
    (name) => !exportedNames.includes(name)
  )
  if (missingNames.length === 0) return []

  const text = sourceFile.getFullText()
  const newLine = text.includes('\r\n') ? '\r\n' : '\n'
  const lastReExport = reExports.at(-1)
  const lastImport = sourceFile.getImportDeclarations().at(-1)

  // Use the quotes and semicolons of the statement the new lines follow.
  const styleStatement = lastReExport?.declaration ?? lastImport
  const quote =
    styleStatement?.getModuleSpecifier()?.getQuoteKind() ?? QuoteKind.Single
  const hasSemicolon = styleStatement?.getText().endsWith(';') ?? false
  const semicolon = hasSemicolon ? ';' : ''
  const reExportLines = missingNames.map(
    (name) =>
      `export * from ${quote}${RUNTIME_IMPORT_PREFIX}${name}${quote}${semicolon}`
  )
  const reExportsCode = reExportLines.join(newLine)

  const headerEnd = getHeaderEnd(text, lastImport)
  let position: number
  let insertedText: string
  if (lastReExport != null) {
    // Extend the existing block of re-exports.
    position = getLineEnd(text, lastReExport.declaration)
    insertedText = `${newLine}${reExportsCode}`
  } else if (headerEnd != null) {
    // Keep blank lines between the header, the re-exports and the code below.
    position = headerEnd
    const lineBreak = isFollowedByBlankLine(text, position) ? '' : newLine
    insertedText = `${newLine}${newLine}${reExportsCode}${lineBreak}`
  } else {
    position = 0
    insertedText = `${reExportsCode}${newLine}${newLine}`
  }

  const updatedText =
    text.slice(0, position) + insertedText + text.slice(position)
  // ts-morph's text omits the byte order mark, so keep the one on disk.
  const filePath = sourceFile.getFilePath()
  const fileText = await readFile(filePath, 'utf8')
  const byteOrderMark = fileText.startsWith(BYTE_ORDER_MARK)
    ? BYTE_ORDER_MARK
    : ''
  await writeFile(filePath, byteOrderMark + updatedText, 'utf8')
  return reExportLines
}

/**
 * Returns the end of the line of the last import, or of the last triple-slash
 * directive if the spec has no imports. Directives only work above the first
 * statement, so new statements must go below them.
 */
function getHeaderEnd(
  text: string,
  lastImport: ImportDeclaration | undefined
): number | undefined {
  if (lastImport != null) return getLineEnd(text, lastImport)
  const leadingComments = ts.getLeadingCommentRanges(text, 0) ?? []
  const directives = leadingComments.filter((comment) =>
    text.startsWith('///', comment.pos)
  )
  // A single-line comment ends at the end of its line.
  return directives.at(-1)?.end
}

/**
 * Returns the end of the line where `node` ends, after its trailing comments
 * and spaces.
 */
function getLineEnd(text: string, node: Node): number {
  const trailingComments = node.getTrailingCommentRanges()
  const end = trailingComments.at(-1)?.getEnd() ?? node.getEnd()
  const trailingSpaces = text.slice(end).match(/^[ \t]*/)?.[0] ?? ''
  return end + trailingSpaces.length
}

/** Returns whether the line after `lineEnd` is empty or whitespace only. */
function isFollowedByBlankLine(text: string, lineEnd: number): boolean {
  return /^\r?\n[ \t]*(\r?\n|$)/.test(text.slice(lineEnd))
}
