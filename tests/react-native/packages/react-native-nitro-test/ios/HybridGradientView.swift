//
//  HybridGradientView.swift
//  react-native-nitro-test
//
//  Created by Patrick Kabwe on 12.06.26.
//

import NitroModules
import UIKit

final class GradientUIView: UIView {
  override class var layerClass: AnyClass {
    return CAGradientLayer.self
  }

  var gradientLayer: CAGradientLayer {
    return layer as! CAGradientLayer
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    gradientLayer.startPoint = CGPoint(x: 0, y: 0)
    gradientLayer.endPoint = CGPoint(x: 1, y: 1)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

class HybridGradientView: HybridGradientViewSpec {
  // View
  let view = GradientUIView()

  // Props
  var colors: [String] = [] {
    didSet {
      view.gradientLayer.colors = colors.compactMap { UIColor(hexString: $0)?.cgColor }
    }
  }
}

private extension UIColor {
  convenience init?(hexString: String) {
    var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") {
      hex.removeFirst()
    }

    guard let value = UInt64(hex, radix: 16) else {
      return nil
    }

    let red, green, blue, alpha: CGFloat
    switch hex.count {
    case 6:
      red = CGFloat((value & 0xFF0000) >> 16) / 255
      green = CGFloat((value & 0x00FF00) >> 8) / 255
      blue = CGFloat(value & 0x0000FF) / 255
      alpha = 1
    case 8:
      red = CGFloat((value & 0xFF00_0000) >> 24) / 255
      green = CGFloat((value & 0x00FF_0000) >> 16) / 255
      blue = CGFloat((value & 0x0000_FF00) >> 8) / 255
      alpha = CGFloat(value & 0x0000_00FF) / 255
    default:
      return nil
    }

    self.init(red: red, green: green, blue: blue, alpha: alpha)
  }
}
