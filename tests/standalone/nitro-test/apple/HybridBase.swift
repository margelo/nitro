//
//  HybridBase.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 03.10.24.
//

import NitroModules

class HybridBase: HybridBaseSpec {
  required override init() throws {
    try super.init()
  }

  static func createAlternativeBase() throws -> any HybridBaseSpec {
    return try HybridAlternativeBase()
  }

  var baseValue: Double {
    return 10
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

private final class HybridAlternativeBase: HybridBase {
  override var baseValue: Double {
    return 11
  }
}
