//
//  HybridPlatformObject.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 27.10.25.
//

import NitroModules
import NitroTestExternal
import Foundation

class HybridPlatformObject: HybridPlatformObjectSpec {
  required override init() throws {
    try super.init()
  }

  func createBase() throws -> any HybridBaseSpec {
    return try HybridBase()
  }

  func createChild() throws -> any HybridChildSpec {
    return try HybridChild()
  }

  func createAlternativeBase() throws -> any HybridBaseSpec {
    return try HybridBase.createAlternativeBase()
  }

  func createInternalObject() throws -> any HybridSomeExternalObjectSpec {
    return try HybridSomeInternalObject()
  }

  func getOSVersion() throws -> String {
    let version = ProcessInfo.processInfo.operatingSystemVersion
    let baseVersion = "\(version.majorVersion).\(version.minorVersion)"
    return version.patchVersion == 0 ? baseVersion : "\(baseVersion).\(version.patchVersion)"
  }
}
