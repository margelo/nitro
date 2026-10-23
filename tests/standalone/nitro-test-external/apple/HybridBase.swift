import NitroModules

class HybridBase: HybridBaseSpec {
  required override init() throws {
    try super.init()
  }

  func createExternalObject() throws -> any HybridSomeExternalObjectSpec {
    return try HybridSomeExternalObject()
  }

  var baseValue: Double {
    return 20
  }

  func bounceSize(size: Size) throws -> Size {
    return size
  }

  func bounceSizeUnit(unit: SizeUnit) throws -> SizeUnit {
    return unit
  }

  func mapSize(size: Size, callback: any Callback<Size, Size>) throws -> any Promise<Size> {
    return callback(size)
  }
}
