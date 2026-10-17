import Foundation
import Testing

private final class TestBundle: NSObject {}

private struct JavaScriptFailure: Error, CustomStringConvertible {
  let description: String
}

@Suite(.serialized)
struct RuntimeTests {
  private static func testNames() throws -> [String] {
    let resources = Bundle(for: TestBundle.self)
    guard let url = resources.url(forResource: "runtime-tests", withExtension: "json") else {
      throw JavaScriptFailure(
        description:
          "Missing runtime-tests.json. Run bun test:prepare before building the test target.")
    }
    let names: [String]
    do {
      names = try JSONDecoder().decode([String].self, from: Data(contentsOf: url))
    } catch {
      throw JavaScriptFailure(description: "Could not read runtime-tests.json: \(error)")
    }
    guard !names.isEmpty else {
      throw JavaScriptFailure(description: "runtime-tests.json contains no JavaScript tests.")
    }
    guard names.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
      throw JavaScriptFailure(description: "runtime-tests.json contains an empty test name.")
    }
    guard Set(names).count == names.count else {
      throw JavaScriptFailure(description: "runtime-tests.json contains duplicate test names.")
    }
    return names
  }

  private func run(_ name: String) throws {
    let resources = Bundle(for: TestBundle.self)
    let url = try #require(resources.url(forResource: "runtime-tests", withExtension: "js"))
    let source = try String(contentsOf: url, encoding: .utf8)
    if let failure = NitroRunTest(source, name, 10000) {
      throw JavaScriptFailure(description: failure)
    }
  }

  @Test(arguments: try RuntimeTests.testNames())
  func javaScript(_ name: String) throws {
    try run(name)
  }

  // These handwritten cases test the runner, not HybridObject behavior. They
  // deliberately fail or hang in JS and check that Swift receives the failure.
  // The TypeScript behavior cases above are discovered from runtime-tests.json.
  @Test func failuresKeepJavaScriptMessage() throws {
    let source = "globalThis.runNitroTest = async () => { throw new Error('sentinel failure') }"
    let failure = try #require(NitroRunTest(source, "failure-contract", 10000))
    #expect(failure.contains("sentinel failure"))
  }

  @Test func evaluationFailuresKeepJavaScriptMessage() throws {
    let failure = try #require(
      NitroRunTest("throw new Error('evaluation failure')", "evaluation-contract", 10000))
    #expect(failure.contains("evaluation failure"))
  }

  @Test func unresolvedPromisesTimeOut() throws {
    let source = "globalThis.runNitroTest = () => new Promise(() => {})"
    let failure = try #require(NitroRunTest(source, "promise-timeout-contract", 100))
    #expect(failure.lowercased().contains("timed out"))
  }

  @Test func synchronousLoopsTimeOut() throws {
    let source = "globalThis.runNitroTest = () => { while (true) {} }"
    let failure = try #require(NitroRunTest(source, "loop-timeout-contract", 100))
    #expect(failure.contains("timeout") || failure.contains("timed out"))
  }
}
