import NitroModules
import NitroTestExternal

class HybridSomeExternalObjectChild: HybridSomeExternalObjectChildSpec {
  var numberCallback: any Callback<Double, Void> = .native { _ in }

  required override init() throws {
    try super.init()
  }

  var childValue: Double {
    return 42
  }

  func getValue() throws -> String {
    return "Hello from SomeExternalObjectChild!"
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
