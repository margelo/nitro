import Foundation
import Testing

private final class TestBundle: NSObject {}

private let runtimeQueue = DispatchQueue(label: "com.margelo.nitro.tests.runtime")

private func runNitroTest(_ source: String, _ name: String, _ timeoutMs: UInt32) async -> String? {
  // The native runner blocks until JS settles. Swift Promise.async fixtures need
  // the cooperative executor to remain free while the runner pumps callbacks.
  await withCheckedContinuation { continuation in
    runtimeQueue.async {
      continuation.resume(returning: NitroRunTest(source, name, timeoutMs))
    }
  }
}

private struct JavaScriptFailure: Error, CustomStringConvertible {
  let description: String
}

@Suite(.serialized)
struct RuntimeTests {
  private static func testNames(skipped: Bool = false) throws -> [String] {
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
    guard let skipsURL = resources.url(forResource: "runtime-test-skips", withExtension: "json")
    else {
      throw JavaScriptFailure(description: "Missing runtime-test-skips.json. Run bun test:prepare.")
    }
    let skips = try JSONDecoder().decode(
      [String: [String: String]].self, from: Data(contentsOf: skipsURL))
    guard Set(skips.keys).isSubset(of: Set(names)),
      skips.values.allSatisfy({ rules in
        rules.allSatisfy { key, reason in
          ["ios", "android", "release"].contains(key) && !reason.isEmpty
        }
      })
    else {
      throw JavaScriptFailure(
        description: "Invalid test exclusion metadata in runtime-test-skips.json.")
    }
    return names.filter { name in
      var reason = skips[name]?["ios"]
      #if !DEBUG
        reason = reason ?? skips[name]?["release"]
      #endif
      return (reason != nil) == skipped
    }
  }

  private func run(_ name: String) async throws {
    let resources = Bundle(for: TestBundle.self)
    let url = try #require(resources.url(forResource: "runtime-tests", withExtension: "js"))
    let source = try String(contentsOf: url, encoding: .utf8)
    if let failure = await runNitroTest(source, name, 10_000) {
      throw JavaScriptFailure(description: failure)
    }
  }

  @Test(arguments: try RuntimeTests.testNames())
  func javaScript(_ name: String) async throws {
    try await run(name)
  }

  // Swift Testing conditions apply to a test function, so keep the source
  // suite's platform/build exclusions in a separate, explicitly disabled group.
  @Test(
    "Existing exclusions from main",
    .disabled("See runtime-test-skips.json for the original platform/build exclusion reasons"),
    arguments: try RuntimeTests.testNames(skipped: true))
  func excludedJavaScript(_ name: String) async throws {
    try await run(name)
  }

  // These handwritten cases test the runner, not HybridObject behavior. They
  // deliberately fail or hang in JS and check that Swift receives the failure.
  // The TypeScript behavior cases above are discovered from runtime-tests.json.
  @Test func failuresKeepJavaScriptMessage() async throws {
    let source = "globalThis.runNitroTest = async () => { throw new Error('sentinel failure') }"
    let failure = try #require(await runNitroTest(source, "failure-contract", 10000))
    #expect(failure.contains("sentinel failure"))
  }

  @Test func evaluationFailuresKeepJavaScriptMessage() async throws {
    let failure = try #require(
      await runNitroTest("throw new Error('evaluation failure')", "evaluation-contract", 10000))
    #expect(failure.contains("evaluation failure"))
  }

  @Test func swiftTasksCanCompleteDuringNativeRun() async throws {
    let source = """
      globalThis.runNitroTest = async () => {
        const object = NitroModulesProxy.createHybridObject('TestObjectSwiftKotlin');
        const value = await object.calculateFibonacciAsync(10);
        if (value !== 55n) throw new Error('Unexpected Fibonacci result');
      };
      """
    let failure = await runNitroTest(source, "swift-task-contract", 2000)
    #expect(failure == nil)
  }

  @Test func reusingBundleKeepsRuntimesIsolated() async throws {
    let source = """
      globalThis.executionCount = (globalThis.executionCount ?? 0) + 1;
      globalThis.runNitroTest = async () => {
        if (globalThis.executionCount !== 1) throw new Error('runtime was reused');
        globalThis.executionCount++;
      };
      """
    for _ in 0..<2 {
      let failure = await runNitroTest(source, "runtime-isolation-contract", 1000)
      #expect(failure == nil)
    }
  }

  @Test func changedBundleReplacesPreparedSource() async throws {
    for message in ["alpha", "bravo", "alpha"] {
      let source = "globalThis.runNitroTest = async () => { throw new Error('\(message)'); };"
      let failure = try #require(await runNitroTest(source, "changed-source-contract", 1000))
      #expect(failure.contains(message))
    }
  }

  @Test func invalidSourceDoesNotPoisonPreparedBundle() async throws {
    let source = "globalThis.runNitroTest = async () => {};"
    let first = await runNitroTest(source, "valid-source-contract", 1000)
    #expect(first == nil)
    let invalid = await runNitroTest(
      "globalThis.runNitroTest = async () => {", "invalid-source-contract", 1000)
    #expect(invalid != nil)
    let repeated = await runNitroTest(source, "valid-source-contract", 1000)
    #expect(repeated == nil)
  }

  @Test func timeoutOverridesApplyOnlyToSelectedCase() async throws {
    let source = """
      globalThis.getNitroTestTimeoutMs = (name) => name === 'slow' ? 2000 : undefined;
      globalThis.runNitroTest = async () => {
        const deadline = Date.now() + 1200;
        while (Date.now() < deadline) {}
      };
      """
    let slow = await runNitroTest(source, "slow", 1000)
    #expect(slow == nil)
    let ordinary = try #require(await runNitroTest(source, "ordinary", 1000))
    #expect(ordinary.localizedCaseInsensitiveContains("timed out"))
    #expect(ordinary.contains("running JS test"))
  }

  @Test func rejectsInvalidTimeoutOverrides() async throws {
    for value in ["0", "-1", "1.5", "NaN", "Infinity", "4294967296", "'1000'", "null"] {
      let source = """
        globalThis.getNitroTestTimeoutMs = () => \(value);
        globalThis.runNitroTest = async () => {};
        """
      let failure = try #require(await runNitroTest(source, "invalid-timeout-contract", 1000))
      #expect(failure.contains("getNitroTestTimeoutMs"))
    }
  }

  @Test func unresolvedPromisesTimeOut() async throws {
    let source = "globalThis.runNitroTest = () => new Promise(() => {})"
    let failure = try #require(await runNitroTest(source, "promise-timeout-contract", 1000))
    #expect(failure.localizedCaseInsensitiveContains("timed out"))
    #expect(failure.contains("running JS test"))
  }

  @Test func evaluationAndTestHaveSeparateTimeouts() async throws {
    let source = """
      function wait(ms) {
        const deadline = Date.now() + ms;
        while (Date.now() < deadline) {}
      }
      wait(600);
      globalThis.runNitroTest = async () => {
        wait(600);
      };
      """
    let failure = await runNitroTest(source, "separate-timeouts-contract", 1000)
    #expect(failure == nil)
  }

  @Test func evaluationLoopsTimeOut() async throws {
    let source = """
      while (true) {}
      """
    let failure = try #require(await runNitroTest(source, "evaluation-timeout-contract", 1000))
    #expect(failure.localizedCaseInsensitiveContains("timed out"))
    #expect(failure.contains("loading JS test bundle"))
  }

  @Test func synchronousLoopsTimeOut() async throws {
    let source = """
      globalThis.runNitroTest = () => {
        while (true) {}
      };
      """
    let failure = try #require(await runNitroTest(source, "loop-timeout-contract", 1000))
    #expect(failure.localizedCaseInsensitiveContains("timed out"))
    #expect(failure.contains("running JS test"))
  }

  @Test func microtaskLoopsTimeOut() async throws {
    let source = """
      globalThis.runNitroTest = async () => {
        while (true) {
          await Promise.resolve();
        }
      };
      """
    let failure = try #require(await runNitroTest(source, "microtask-timeout-contract", 1000))
    #expect(failure.localizedCaseInsensitiveContains("timed out"))
    #expect(failure.contains("running JS test"))
  }
}
