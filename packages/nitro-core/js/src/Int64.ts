/**
 * Represents an unsigned 64-bit integer (or "uint64").
 */
export type UInt64 = bigint & { __unsignedTag?: never }

/**
 * Represents a signed 64-bit integer (or "int64").
 */
export type Int64 = bigint & { __signedTag?: never }
