import NitroModules
import UIKit

class HybridTestView: HybridTestViewSpec {
  var view: UIView = UIView()

  var isBlue: Bool = false {
    didSet {
      view.backgroundColor = isBlue ? .systemBlue : .systemRed
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
