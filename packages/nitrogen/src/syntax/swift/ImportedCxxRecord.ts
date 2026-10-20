import type { TypeContext } from '../types/Type.js'

// TODO: Remove this file once our minimum Xcode includes
// https://github.com/swiftlang/swift/pull/93293. Nitrogen names imported C++ records
// only to work around https://github.com/swiftlang/swift/issues/93289;
// createSwiftForeignTypeMetadata.ts lists the other parts to remove.

/** A C++ record that Swift imports, such as `margelo::nitro::ArrayBuffer`. */
export interface ImportedCxxRecord {
  /** The record's namespaces, which Swift imports as enums. */
  readonly namespaces: string[]
  /** How Swift names the record, e.g. `Callback<(() -> Void)>`. */
  readonly swiftName: string
  /** A C identifier that is unique to the record in its module, e.g. `Callback_void`. */
  readonly identifier: string
}

/** How Swift names a record in imported class template specializations, e.g. `margelo.nitro.ArrayBuffer`. */
export function getQualifiedSwiftName(record: ImportedCxxRecord): string {
  return [...record.namespaces, record.swiftName].join('.')
}

/**
 * How Swift names a C++ type that generated code passes as a `const T&` parameter,
 * when it appears in imported class template specializations.
 */
export function getClangImporterReferenceName(
  name: string,
  context: TypeContext
): string {
  return context === 'parameter' ? `__cxxLRef<__cxxConst<${name}>>` : name
}

/**
 * Returns the type metadata accessor that Swift emits for an imported C++ record,
 * e.g. `$sSo7margeloO5nitroO11ArrayBufferVMa` for `margelo::nitro::ArrayBuffer`.
 * Swift mangles namespaces as enums (`O`) and records as structs (`V`) in the clang module (`So`).
 */
export function getSwiftMetadataAccessorName(
  record: ImportedCxxRecord
): string {
  const context = record.namespaces
    .map((namespace) => `${mangleIdentifier(namespace)}O`)
    .join('')
  return `$sSo${context}${mangleIdentifier(record.swiftName)}VMa`
}

/**
 * Swift's `mangleIdentifier` (ManglingUtils.h). Swift would substitute repeated words
 * and identifiers, but the namespaces and record names without template arguments
 * that Nitro imports never repeat one.
 */
function mangleIdentifier(identifier: string): string {
  const needsPunycode = Array.from(identifier).some(
    (character) => !isSymbolCharacter(character)
  )
  if (!needsPunycode) return `${identifier.length}${identifier}`
  const encoded = encodePunycode(identifier)
  const separator = /^[0-9_]/.test(encoded) ? '_' : ''
  return `00${encoded.length}${separator}${encoded}`
}

function isSymbolCharacter(character: string): boolean {
  return /^[a-zA-Z0-9_$]$/.test(character)
}

const PUNYCODE_BASE = 36
const PUNYCODE_T_MIN = 1
const PUNYCODE_T_MAX = 26

/**
 * Swift's Punycode variant (Punycode.cpp), which maps ASCII characters that
 * are invalid in symbols to code points from `0xD800`.
 */
function encodePunycode(identifier: string): string {
  const codePoints = Array.from(identifier).map((character) => {
    const codePoint = character.charCodeAt(0)
    if (codePoint >= 0x80) {
      throw new Error(`Cannot mangle non-ASCII C++ name "${identifier}"`)
    }
    return isSymbolCharacter(character) ? codePoint : codePoint + 0xd800
  })
  const basicCodePoints = codePoints.filter((codePoint) => codePoint < 0x80)
  let output = String.fromCharCode(...basicCodePoints)
  if (basicCodePoints.length > 0) output += '_'

  let n = 0x80
  let delta = 0
  let bias = 72
  let handled = basicCodePoints.length
  while (handled < codePoints.length) {
    const nextCodePoints = codePoints.filter((codePoint) => codePoint >= n)
    const m = Math.min(...nextCodePoints)
    delta += (m - n) * (handled + 1)
    n = m
    for (const codePoint of codePoints) {
      if (codePoint < n) delta++
      if (codePoint !== n) continue
      let q = delta
      for (let k = PUNYCODE_BASE; ; k += PUNYCODE_BASE) {
        const t = Math.min(Math.max(k - bias, PUNYCODE_T_MIN), PUNYCODE_T_MAX)
        if (q < t) break
        output += getPunycodeDigit(t + ((q - t) % (PUNYCODE_BASE - t)))
        q = Math.floor((q - t) / (PUNYCODE_BASE - t))
      }
      output += getPunycodeDigit(q)
      bias = adaptPunycodeBias(
        delta,
        handled + 1,
        handled === basicCodePoints.length
      )
      delta = 0
      handled++
    }
    delta++
    n++
  }
  return output
}

function getPunycodeDigit(digit: number): string {
  // Swift uses a-z for 0-25 and A-J for 26-35.
  return String.fromCharCode(digit < 26 ? 0x61 + digit : 0x41 - 26 + digit)
}

function adaptPunycodeBias(
  delta: number,
  pointCount: number,
  isFirstTime: boolean
): number {
  let adapted = Math.floor(delta / (isFirstTime ? 700 : 2))
  adapted += Math.floor(adapted / pointCount)
  let k = 0
  const threshold = Math.floor(
    ((PUNYCODE_BASE - PUNYCODE_T_MIN) * PUNYCODE_T_MAX) / 2
  )
  while (adapted > threshold) {
    adapted = Math.floor(adapted / (PUNYCODE_BASE - PUNYCODE_T_MIN))
    k += PUNYCODE_BASE
  }
  const skew = 38
  return (
    k +
    Math.floor(
      ((PUNYCODE_BASE - PUNYCODE_T_MIN + 1) * adapted) / (adapted + skew)
    )
  )
}
