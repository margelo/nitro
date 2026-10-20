import NitroModules

class HybridBase: HybridBaseSpec {
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
