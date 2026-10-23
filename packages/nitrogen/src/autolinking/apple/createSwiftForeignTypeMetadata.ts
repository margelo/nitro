import { NitroConfig } from '../../config/NitroConfig.js'
import { getImportsCode } from '../../syntax/getImportCode.js'
import { createFileMetadataString } from '../../syntax/helpers.js'
import type { SourceFile } from '../../syntax/SourceFile.js'
import { getSwiftImports } from '../../syntax/swift/getSwiftImports.js'
import { getQualifiedSwiftName, getSwiftMetadataAccessorName } from '../../syntax/swift/ImportedCxxRecord.js'
import { SwiftArrayType } from '../../syntax/swift/types/SwiftArrayType.js'
import { SwiftOptionalType } from '../../syntax/swift/types/SwiftOptionalType.js'
import { SwiftRecordType } from '../../syntax/swift/types/SwiftRecordType.js'
import type { SwiftType } from '../../syntax/swift/types/SwiftType.js'

// TODO: Remove this workaround for https://github.com/swiftlang/swift/issues/93289
// once our minimum Xcode includes https://github.com/swiftlang/swift/pull/93293.
// Delete this file, ImportedCxxRecord.ts, SwiftType's `importedCxxRecord` and
// `getClangImporterName()` with their implementations, and the calls in
// createAppleAutolinking.ts and createSwiftUmbrellaHeader.ts. Each of them has a
// TODO that links the pull request.
//
// C++ gets the type metadata of an imported C++ record from Swift's metadata
// accessor when it stores the record in a swift::Optional, swift::Array or
// dictionary slot. Swift emits those accessors as hidden, and Swift Build's
// partial link (`ld -r`) of the Swift target makes them local, so the
// SwiftBridge target fails to link. The umbrella header renames the accessors
// to exported Swift functions that return the same metadata.

interface ForeignTypeMetadata {
  /** The imported C++ record's type. */
  type: SwiftType
  /** The record's qualified Swift name. */
  name: string
  /** The hidden metadata accessor that `-Swift.h` calls. */
  accessor: string
  /** The exported Swift function that replaces it. */
  forwarder: string
}

/** The types that C++ stores in Swift generics. */
function getSwiftGenericArguments(type: SwiftType): SwiftType[] {
  if (type instanceof SwiftOptionalType) return [type.wrappingType]
  if (type instanceof SwiftArrayType) return [type.itemType]
  if (type instanceof SwiftRecordType) return [type.keyType, type.valueType]
  return []
}

/** The imported C++ records whose type metadata C++ requests from Swift. */
function getForeignTypeMetadata(types: SwiftType[]): ForeignTypeMetadata[] {
  const moduleName = NitroConfig.current.getAppleModuleName()
  const metadata = new Map<string, ForeignTypeMetadata>()
  for (const type of types.flatMap(getSwiftGenericArguments)) {
    const record = type.importedCxxRecord
    if (record == null) continue
    const accessor = getSwiftMetadataAccessorName(record)
    if (metadata.has(accessor)) continue
    metadata.set(accessor, {
      type: type,
      name: getQualifiedSwiftName(record),
      accessor: accessor,
      forwarder: `nitro_${moduleName}_metadata_${record.identifier}`,
    })
  }
  return [...metadata.values()].toSorted((a, b) => a.forwarder.localeCompare(b.forwarder))
}

/**
 * Renames the metadata accessors that the module's `-Swift.h` calls.
 * Must precede every `-Swift.h` include.
 */
export function createForeignTypeMetadataPragmas(types: SwiftType[]): string {
  const metadata = getForeignTypeMetadata(types)
  if (metadata.length === 0) return ''
  const moduleName = NitroConfig.current.getAppleModuleName()
  // Mach-O symbols of C and Swift functions start with an underscore.
  const pragmas = metadata.map(({ accessor, forwarder }) => `#pragma redefine_extname ${accessor} _${forwarder}`)
  return `
// TODO: Remove once react-nitro's minimum Xcode includes https://github.com/swiftlang/swift/pull/93293.
// Works around https://github.com/swiftlang/swift/issues/93289: ${moduleName}-Swift.h calls hidden
// Swift metadata accessors, so call the exported functions in ${moduleName}+ForeignTypeMetadata.swift
// instead. Must precede every -Swift.h include.
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdollar-in-identifier-extension"
${pragmas.join('\n')}
#pragma clang diagnostic pop
`.trim()
}

/** Exports the type metadata that the umbrella header's pragmas redirect to. */
export function createSwiftForeignTypeMetadata(types: SwiftType[]): SourceFile[] {
  const metadata = getForeignTypeMetadata(types)
  if (metadata.length === 0) return []
  const moduleName = NitroConfig.current.getAppleModuleName()
  const filename = `${moduleName}+ForeignTypeMetadata.swift`
  const imports = getImportsCode(
    getSwiftImports(
      metadata.map(({ type }) => type),
      'internal'
    )
  )
  const forwarders = metadata.map(({ type, name, accessor, forwarder }) => {
    const swiftType = type.getCode('swift', { context: 'type-argument' })
    return `
/// Exported copy of \`${accessor}\`, the type metadata accessor of \`${name}\`.
@_silgen_name("${forwarder}")
public func __${forwarder}(_ request: UInt) -> (UnsafeRawPointer, UInt) {
  // Imported C++ records' metadata is always complete (MetadataState::Complete).
  return (unsafeBitCast(${swiftType}.self as Any.Type, to: UnsafeRawPointer.self), 0)
}
`.trim()
  })

  const code = `
${createFileMetadataString(filename)}

${imports}

// TODO: Remove this file once react-nitro's minimum Xcode includes https://github.com/swiftlang/swift/pull/93293.
// Works around https://github.com/swiftlang/swift/issues/93289: ${moduleName}-Swift.h gets the type metadata
// of imported C++ types from their metadata accessors, which Swift emits as hidden.
// ${moduleName}-Swift-Cxx-Umbrella.hpp renames those calls to these exported functions.

${forwarders.join('\n\n')}
`.trim()

  return [
    {
      name: filename,
      language: 'swift',
      platform: 'apple',
      subdirectory: ['swift'],
      content: code,
    },
  ]
}
