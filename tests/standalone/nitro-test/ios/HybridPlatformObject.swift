//
//  HybridPlatformObject.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 27.10.25.
//

import UIKit

class HybridPlatformObject: HybridPlatformObjectSpec {
  func getOSVersion() -> String {
    return UIDevice.current.systemVersion
  }
}
