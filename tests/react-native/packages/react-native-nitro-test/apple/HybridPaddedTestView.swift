import NitroModules
import UIKit

final class HybridPaddedTestView: HybridPaddedTestViewSpec {
  override init() throws {
    try super.init()
  }

  let view = MainActor.assumeIsolated {
    let view = PaddedTestUIView()
    view.backgroundColor = .blue
    return view
  }
}
