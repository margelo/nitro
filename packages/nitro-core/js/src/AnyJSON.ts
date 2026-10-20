/**
 * Represents any kind of a JSON-serializable value.
 * Supported types:
 * - Primitives (`string`, `number`, `boolean`, `null`)
 * - Arrays of primitives (`[]`)
 * - Objects of primitives (`object`)
 * - Arrays of arrays or objects
 * - Objects of arrays or objects
 *
 * @note It is recommended to always use typed `interface`s instead of `AnyJSON` for
 * both type safety, as well as better performance.
 */
export type AnyJSON =
  | string
  | number
  | boolean
  | null
  | AnyJSON[]
  | { [key: string]: AnyJSON }
