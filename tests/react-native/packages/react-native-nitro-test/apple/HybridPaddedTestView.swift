import NitroModules
import UIKit

final class HybridPaddedTestView: HybridPaddedTestViewSpec {
  override init() throws {
    try super.init()
  }

  let view: UIView = MainActor.assumeIsolated {
    let view = UIView()
    view.backgroundColor = .blue
    return view
  }
}
