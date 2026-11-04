//
//  HybridBase.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 03.10.24.
//

import NitroModules
import NitroTestExternal

class HybridBase: HybridBaseSpec {
  required override init() throws {
    try super.init()
  }

  static func createAlternativeBase() throws -> any HybridBaseSpec {
    return try HybridAlternativeBase()
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
  required init() throws {
    try super.init()
    baseValue = 11
  }
}
