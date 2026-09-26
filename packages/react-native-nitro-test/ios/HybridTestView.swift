//
//  HybridTestView.swift
//  react-native-nitro-test
//
//  Created by Marc Rousavy on 03.10.24.
//

import NitroModules
import UIKit

class HybridTestView: HybridTestViewSpec {
  // UIView
  var view: UIView = UIView()
  private let lifecycleLock = NSLock()
  private var onDropViewCount: Double = 0
  private var isBlueSetterCallCount: Double = 0
  private var nativeDefaultValueSetterCallCount: Double = 0

  // Props
  var isBlue: Bool = false {
    didSet {
      isBlueSetterCallCount += 1
      view.backgroundColor = isBlue ? .systemBlue : .systemRed
    }
  }
  var hasBeenCalled: Bool = false
  var colorScheme: ColorScheme = .light
  var someCallback: () -> Void = {}
  var nativeDefaultValue: Double? = 42 {
    didSet {
      nativeDefaultValueSetterCallCount += 1
    }
  }

  // Methods
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
