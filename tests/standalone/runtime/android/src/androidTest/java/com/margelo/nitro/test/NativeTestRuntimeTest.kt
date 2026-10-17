package com.margelo.nitro.test

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeTestRuntimeTest {
  @Test
  fun reportsJavaScriptFailures() {
    val failure =
      NativeTestRuntime.runTest(
        "globalThis.runNitroTest = async () => { throw new Error('sentinel failure'); };",
        "bridge failure",
      )
    assertTrue(failure, failure.contains("sentinel failure"))
  }

  @Test
  fun reportsSynchronousJavaScriptFailures() {
    val failure = NativeTestRuntime.runTest("throw new Error('sync sentinel');", "bundle failure")
    assertTrue(failure, failure.contains("sync sentinel"))
  }

  @Test
  fun reusingBundleKeepsRuntimesIsolated() {
    val source =
      """
      globalThis.executionCount = (globalThis.executionCount ?? 0) + 1;
      globalThis.runNitroTest = async () => {
        if (globalThis.executionCount !== 1) throw new Error('runtime was reused');
        globalThis.executionCount++;
      };
      """.trimIndent()
    repeat(2) {
      val failure = NativeTestRuntime.runTest(source, "runtime isolation", 1000)
      assertTrue(failure, failure.isEmpty())
    }
  }

  @Test
  fun changedBundleReplacesPreparedSource() {
    for (message in listOf("alpha", "bravo", "alpha")) {
      val source = "globalThis.runNitroTest = async () => { throw new Error('$message'); };"
      val failure = NativeTestRuntime.runTest(source, "changed source", 1000)
      assertTrue(failure, failure.contains(message))
    }
  }

  @Test
  fun invalidSourceDoesNotPoisonPreparedBundle() {
    val source = "globalThis.runNitroTest = async () => {};"
    val first = NativeTestRuntime.runTest(source, "valid source", 1000)
    assertTrue(first, first.isEmpty())
    val invalid = NativeTestRuntime.runTest("globalThis.runNitroTest = async () => {", "invalid source", 1000)
    assertTrue("Invalid source unexpectedly passed", invalid.isNotEmpty())
    val repeated = NativeTestRuntime.runTest(source, "valid source", 1000)
    assertTrue(repeated, repeated.isEmpty())
  }

  @Test
  fun timeoutOverridesApplyOnlyToSelectedCase() {
    val source =
      """
      globalThis.getNitroTestTimeoutMs = (name) => name === 'slow' ? 2000 : undefined;
      globalThis.runNitroTest = async () => {
        const deadline = Date.now() + 1200;
        while (Date.now() < deadline) {}
      };
      """.trimIndent()
    val slow = NativeTestRuntime.runTest(source, "slow", 1000)
    assertTrue(slow, slow.isEmpty())
    val ordinary = NativeTestRuntime.runTest(source, "ordinary", 1000)
    assertTrue(ordinary, ordinary.contains("timed out", ignoreCase = true))
    assertTrue(ordinary, ordinary.contains("running JS test"))
  }

  @Test
  fun rejectsInvalidTimeoutOverrides() {
    for (value in listOf("0", "-1", "1.5", "NaN", "Infinity", "4294967296", "'1000'", "null")) {
      val source =
        """
        globalThis.getNitroTestTimeoutMs = () => $value;
        globalThis.runNitroTest = async () => {};
        """.trimIndent()
      val failure = NativeTestRuntime.runTest(source, "invalid timeout $value", 1000)
      assertTrue(failure, failure.contains("getNitroTestTimeoutMs"))
    }
  }

  @Test
  fun timesOutPendingPromises() {
    val failure =
      NativeTestRuntime.runTest(
        "globalThis.runNitroTest = () => new Promise(() => {});",
        "pending promise",
        1000,
      )
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("running JS test"))
  }

  @Test
  fun evaluationAndTestHaveSeparateTimeouts() {
    val source =
      """
      function wait(ms) {
        const deadline = Date.now() + ms;
        while (Date.now() < deadline) {}
      }
      wait(600);
      globalThis.runNitroTest = async () => {
        wait(600);
      };
      """.trimIndent()
    val failure = NativeTestRuntime.runTest(source, "separate timeouts", 1000)
    assertTrue(failure, failure.isEmpty())
  }

  @Test
  fun timesOutBundleEvaluation() {
    val source =
      """
      while (true) {}
      """.trimIndent()
    val failure = NativeTestRuntime.runTest(source, "evaluation loop", 1000)
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("loading JS test bundle"))
  }

  @Test
  fun timesOutSynchronousJavaScript() {
    val source =
      """
      globalThis.runNitroTest = () => {
        while (true) {}
      };
      """.trimIndent()
    val failure = NativeTestRuntime.runTest(source, "test loop", 1000)
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("running JS test"))
  }

  @Test
  fun timesOutMicrotaskLoops() {
    val source =
      """
      globalThis.runNitroTest = async () => {
        while (true) {
          await Promise.resolve();
        }
      };
      """.trimIndent()
    val failure = NativeTestRuntime.runTest(source, "microtask loop", 1000)
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("running JS test"))
  }
}
