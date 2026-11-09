import NitroModules
import UIKit

final class HybridPaddedTestView: HybridPaddedTestViewSpec {
  let view = MainActor.assumeIsolated {
    let view = PaddedTestUIView()
    view.backgroundColor = .blue
    return view
  }
}
