import NitroModules
import UIKit

class HybridTestView: HybridTestViewSpec {
  override init() throws {
    try super.init()
  }

  var view: UIView = MainActor.assumeIsolated { UIView() }

  var isBlue: Bool = false {
    didSet {
      MainActor.assumeIsolated { [view, isBlue] in
        view.backgroundColor = isBlue ? .systemBlue : .systemRed
      }
    }
  }
  var someCallback: any Callback<(), Void> = .native {}

  func someMethod() throws {
    someCallback()
  }

  func getModuleName() throws -> String {
    return "NitroTestExternal"
  }
}
