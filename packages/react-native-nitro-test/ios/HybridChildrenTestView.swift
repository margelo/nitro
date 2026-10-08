//
//  HybridChildrenTestView.swift
//  react-native-nitro-test
//

import NitroModules
import UIKit

class HybridChildrenTestView: HybridChildrenTestViewSpec {
  // UIView - React children are mounted into it
  var view: UIView = UIView()

  // Props
  var isBlue: Bool = false {
    didSet {
      view.backgroundColor = isBlue ? .systemBlue : .systemRed
    }
  }

  // Methods
  func getNativeChildCount() throws -> Double {
    return Double(view.subviews.count)
  }
}
