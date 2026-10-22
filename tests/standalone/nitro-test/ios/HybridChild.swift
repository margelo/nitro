//
//  HybridChild.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 03.10.24.
//

import NitroModules

class HybridChild: HybridChildSpec {
  required override init() throws {
    try super.init()
  }

  var baseValue: Double {
    return 20
  }
  var childValue: Double {
    return 30
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

  func bounceVariant(variant: NamedVariant) throws -> NamedVariant {
    return variant
  }

  func toString() -> String {
    return "HybridChild custom toString() :)"
  }
}
