import UIKit

// Keep native padding fixed when React Native assigns the content view's frame.
final class PaddedTestUIView: UIView {
  private static let padding: CGFloat = 7

  override var frame: CGRect {
    get { super.frame }
    set {
      guard let superview else {
        super.frame = newValue
        return
      }

      let bounds = superview.bounds
      let padding = Self.padding
      super.frame = CGRect(
        x: bounds.minX + padding,
        y: bounds.minY + padding,
        width: max(0, bounds.width - 2 * padding),
        height: max(0, bounds.height - 2 * padding)
      )
    }
  }
}
