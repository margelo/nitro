import NitroModules
import UIKit

final class HybridPaddedTestView: HybridPaddedTestViewSpec {
  let view: UIView = {
    let view = UIView()
    view.backgroundColor = .blue
    return view
  }()
}
