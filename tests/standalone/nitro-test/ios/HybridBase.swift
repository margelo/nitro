//
//  HybridBase.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 03.10.24.
//

import NitroModules

class HybridBase: HybridBaseSpec {
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
