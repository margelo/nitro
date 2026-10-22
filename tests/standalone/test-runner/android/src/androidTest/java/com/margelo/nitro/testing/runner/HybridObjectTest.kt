package com.margelo.nitro.testing.runner

import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Future

@RunWith(RuntimeSuiteRunner::class)
class HybridObjectTest(
  private val suite: Suite,
) {
  @Test
  fun runJavaScriptSuite() {
    assumeTrue(suite.skipReason, suite.skipReason == null)
    val failure =
      try {
        suite.result.get()
      } catch (error: ExecutionException) {
        throw error.cause ?: error
      }
    if (failure.isNotEmpty()) throw AssertionError("${suite.name}\n$failure")
  }

  class Suite(
    val name: String,
    val names: Array<String>,
    val skipReason: String?,
  ) {
    lateinit var result: Future<String>

    // TODO: Remove after upgrading to AGP 9, which escapes slashes in logcat filenames.
    // https://issuetracker.google.com/issues/223643506
    // https://android.googlesource.com/platform/tools/base/+/e001560f772e0685e24b5becb56861caa8498e69
    override fun toString(): String = name.replace('/', '-')
  }

  companion object {
    private val suites by lazy { readSuites() }

    @JvmStatic
    @Parameterized.Parameters(name = "{0}")
    fun cases(): List<Array<Suite>> = suites.map { arrayOf(it) }

    fun startSuites(
      executor: ExecutorService,
      selected: Set<String>,
    ) {
      val bundle = readAsset("runtime-tests.js")
      for (suite in suites) {
        if (suite.skipReason == null && "[${suite.name}]" in selected) {
          suite.result = executor.submit<String> { NativeTestRuntime.runSuite(bundle, suite.names) }
        }
      }
    }

    private fun readSuites(): List<Suite> {
      val parser = JSONTokener(readAsset("runtime-tests.json"))
      val manifest = parser.nextValue()
      require(manifest is JSONObject && parser.nextClean() == '\u0000') {
        "runtime-tests.json must contain an object of test suites"
      }
      require(manifest.length() > 0) { "runtime-tests.json contains no tests" }

      val skipParser = JSONTokener(readAsset("runtime-test-skips.json"))
      val skips = skipParser.nextValue()
      require(skips is JSONObject && skipParser.nextClean() == '\u0000') {
        "runtime-test-skips.json must contain an object"
      }

      val names = mutableSetOf<String>()
      val cases = mutableListOf<Suite>()
      manifest.keys().forEach { suite ->
        require(suite.isNotBlank()) { "runtime-tests.json contains a blank suite name" }
        val suiteNames = manifest.get(suite)
        require(suiteNames is JSONArray && suiteNames.length() > 0) {
          "runtime-tests.json suite $suite must contain a nonempty array of test names"
        }
        val enabledNames = mutableListOf<String>()
        for (index in 0 until suiteNames.length()) {
          val name = suiteNames.get(index)
          require(name is String && name.isNotBlank()) {
            "runtime-tests.json suite $suite entry $index must be a nonblank string"
          }
          require(names.add(name)) { "runtime-tests.json contains duplicate test: $name" }
          val rules = if (skips.has(name)) skips.getJSONObject(name) else null
          rules?.keys()?.forEach { key ->
            require(key in listOf("apple", "android", "release") && rules.getString(key).isNotEmpty()) {
              "Invalid exclusion for test $name"
            }
          }
          val reason =
            when {
              rules?.has("android") == true -> rules.getString("android")
              !BuildConfig.DEBUG && rules?.has("release") == true -> rules.getString("release")
              else -> null
            }
          if (reason == null) {
            enabledNames.add(name)
          } else {
            cases.add(Suite(name, emptyArray(), reason))
          }
        }
        if (enabledNames.isNotEmpty()) cases.add(Suite(suite, enabledNames.toTypedArray(), null))
      }
      require(skips.keys().asSequence().all { it in names }) { "Exclusions contain an unknown test name" }
      return cases
    }

    private fun readAsset(name: String): String =
      InstrumentationRegistry
        .getInstrumentation()
        .context.assets
        .open(name)
        .bufferedReader()
        .use { it.readText() }
  }
}
