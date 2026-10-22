import type { Node } from 'ts-morph'
import { errorToString } from './utils.js'

/** A spec diagnostic that already identifies its offending source declaration. */
export class SourceError extends Error {
  constructor(node: Node, message: string, options?: ErrorOptions) {
    const source = node.getSourceFile()
    const { line, column } = source.getLineAndColumnAtPos(node.getStart())
    super(`${source.getFilePath()}:${line}:${column}: ${message}`, options)
  }
}

/** Keep a nested diagnostic's location when a containing declaration also fails. */
export function withSourceLocation<T>(node: Node, action: () => T): T {
  try {
    return action()
  } catch (error) {
    if (error instanceof SourceError) throw error
    const message = error instanceof Error ? error.message : errorToString(error)
    throw new SourceError(node, message, { cause: error })
  }
}
