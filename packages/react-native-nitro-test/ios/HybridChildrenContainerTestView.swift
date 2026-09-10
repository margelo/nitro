//
//  HybridChildrenContainerTestView.swift
//  react-native-nitro-test
//

import NitroModules
import UIKit

/// A `UIView` that keeps a single container sub-view at its own size.
private final class ContainerHostView: UIView {
  let childrenContainer = UIView()

  override init(frame: CGRect) {
    super.init(frame: frame)
    addSubview(childrenContainer)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    childrenContainer.frame = bounds
  }
}

class HybridChildrenContainerTestView: HybridChildrenContainerTestViewSpec {
  private let hostView = ContainerHostView()

  // UIView
  var view: UIView { hostView }
  // React children are mounted into this sub-view instead of `view`
  var childrenContainer: UIView { hostView.childrenContainer }

  // Props
  var isBlue: Bool = false {
    didSet {
      hostView.backgroundColor = isBlue ? .systemBlue : .systemRed
    }
  }

  // Methods
  func getNativeChildCount() throws -> Double {
    return Double(hostView.childrenContainer.subviews.count)
  }

  func getViewChildCount() throws -> Double {
    return Double(hostView.subviews.count)
  }
}
