//
//  HybridTestObjectSwift.swift
//  NitroTest
//
//  Created by Marc Rousavy on 11.08.24.
//

import NitroModules
import NitroTestExternal

class HybridSomeInternalObject: HybridSomeExternalObjectSpec {
  func getValue() throws -> String {
    return "This is overridden!"
  }

  func createOptionalPrimitivesHolder(
    optionalNumber: Double?, optionalBoolean: Bool?, optionalUInt64: UInt64?, optionalInt64: Int64?
  ) -> OptionalPrimitivesHolder {
    return OptionalPrimitivesHolder(
      optionalNumber: optionalNumber,
      optionalBoolean: optionalBoolean,
      optionalUInt64: optionalUInt64,
      optionalInt64: optionalInt64
    )
  }
}
