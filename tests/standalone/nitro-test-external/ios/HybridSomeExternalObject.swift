//
//  HybridSomeExternalObject
//  NitroTestExternal
//
//  Created by Marc Rousavy on 14.08.25.
//

import NitroModules

class HybridSomeExternalObject: HybridSomeExternalObjectSpec {
  func getValue() throws -> String {
    return "Hello world!"
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
