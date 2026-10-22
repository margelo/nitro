//
//  HybridTestView.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 03.10.24.
//

import NitroModules
import UIKit

class HybridTestView: HybridTestViewSpec {
  override init() throws {
    try super.init()
  }

  // UIView
  var view: UIView = MainActor.assumeIsolated { UIView() }
  private let lifecycleLock = NSLock()
  private var onDropViewCount: Double = 0
  private var isBlueSetterCallCount: Double = 0
  private var nativeDefaultValueSetterCallCount: Double = 0

  // Props
  var isBlue: Bool = false {
    didSet {
      isBlueSetterCallCount += 1
      MainActor.assumeIsolated { [view, isBlue] in
        view.backgroundColor = isBlue ? .systemBlue : .systemRed
      }
    }
  }
  var hasBeenCalled: Bool = false
  var int64Value: Int64 = 0
  var colorScheme: ColorScheme = .light
  var someCallback: any Callback<(), Void> = .native {}
  var nativeDefaultValue: Double? = 42 {
    didSet {
      nativeDefaultValueSetterCallCount += 1
    }
  }

  // Methods
  func getIsViewBlue(view: any HybridTestViewSpec) throws -> Bool {
    return view.isBlue
  }

  func getOnDropViewCount() throws -> Double {
    return lifecycleLock.withLock { onDropViewCount }
  }

  func getIsBlueSetterCallCount() throws -> Double {
    return isBlueSetterCallCount
  }

  func getNativeDefaultValueSetterCallCount() throws -> Double {
    return nativeDefaultValueSetterCallCount
  }

  func someMethod() throws {
    hasBeenCalled = true
    someCallback()
  }

  func onDropView() {
    lifecycleLock.withLock {
      onDropViewCount += 1
    }
  }

}
