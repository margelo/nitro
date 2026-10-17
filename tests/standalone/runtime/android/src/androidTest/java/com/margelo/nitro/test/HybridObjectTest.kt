package com.margelo.nitro.test

import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class HybridObjectTest(
  private val name: String,
  private val skipReason: String?,
) {
  @Test
  fun runJavaScriptTest() {
    assumeTrue(skipReason, skipReason == null)
    val failure = NativeTestRuntime.runTest(readAsset("runtime-tests.js"), name)
    if (failure.isNotEmpty()) throw AssertionError(failure)
  }

  companion object {
    @JvmStatic
    @Parameterized.Parameters(name = "{0}")
    fun cases(): List<Array<Any?>> {
      val parser = JSONTokener(readAsset("runtime-tests.json"))
      val manifest = parser.nextValue()
      require(manifest is JSONArray && parser.nextClean() == '\u0000') {
        "runtime-tests.json must contain an array of test names"
      }
      require(manifest.length() > 0) { "runtime-tests.json contains no tests" }

      val skipParser = JSONTokener(readAsset("runtime-test-skips.json"))
      val skips = skipParser.nextValue()
      require(skips is JSONObject && skipParser.nextClean() == '\u0000') {
        "runtime-test-skips.json must contain an object"
      }

      val names = mutableSetOf<String>()
      val cases =
        (0 until manifest.length()).map { index ->
          val name = manifest.get(index)
          require(name is String && name.isNotBlank()) {
            "runtime-tests.json entry $index must be a nonblank string"
          }
          require(names.add(name)) { "runtime-tests.json contains duplicate test: $name" }
          val rules = if (skips.has(name)) skips.getJSONObject(name) else null
          rules?.keys()?.forEach { key ->
            require(key in listOf("ios", "android", "release") && rules.getString(key).isNotEmpty()) {
              "Invalid exclusion for test $name"
            }
          }
          val reason =
            when {
              rules?.has("android") == true -> rules.getString("android")
              !BuildConfig.DEBUG && rules?.has("release") == true -> rules.getString("release")
              else -> null
            }
          arrayOf<Any?>(name, reason)
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
