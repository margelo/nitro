#include "TestRuntime.hpp"

#include <NitroModules/Dispatcher.hpp>
#include <NitroModules/InstallNitro.hpp>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <future>
#include <hermes/hermes.h>
#include <jsi/instrumentation.h>
#include <limits>
#include <mutex>
#include <queue>
#include <thread>

namespace margelo::nitro::testing {
namespace {
  using namespace facebook;
  using Clock = std::chrono::steady_clock;

  // The test caller owns Hermes. Native workers enqueue callbacks here, and
  // tick() runs them on that same caller thread between microtask drains.
  class TestDispatcher final : public Dispatcher {
  public:
    void runSync(std::function<void()>&& function) override {
      if (std::this_thread::get_id() == owner) {
        function();
        return;
      }
      auto task = std::make_shared<std::packaged_task<void()>>(std::move(function));
      auto result = task->get_future();
      // The queue owns the task so close() unblocks waiters with broken_promise.
      if (!enqueue([task = std::move(task)] { (*task)(); }))
        throw std::runtime_error("Test runtime is closed");
      result.get();
    }

    void runAsync(std::function<void()>&& function) override {
      // Late native Promise completions must not enter a destroyed runtime.
      enqueue(std::move(function));
    }

    void tick(Clock::time_point deadline) {
      std::function<void()> task;
      {
        std::unique_lock lock(mutex);
        changed.wait_until(lock, deadline, [&] { return closed || !tasks.empty(); });
        if (tasks.empty())
          return;
        task = std::move(tasks.front());
        tasks.pop();
      }
      task();
    }

    void close() {
      std::queue<std::function<void()>> discarded;
      {
        std::lock_guard lock(mutex);
        closed = true;
        tasks.swap(discarded);
      }
      changed.notify_all();
      // Release pending JSI handles on their owning thread, before Hermes dies.
    }

  private:
    bool enqueue(std::function<void()>&& task) {
      {
        std::lock_guard lock(mutex);
        if (closed)
          return false;
        tasks.push(std::move(task));
      }
      changed.notify_one();
      return true;
    }

    const std::thread::id owner = std::this_thread::get_id();
    std::mutex mutex;
    std::condition_variable changed;
    std::queue<std::function<void()>> tasks;
    bool closed = false;
  };

  std::string describeError(jsi::Runtime& runtime, const jsi::Value& error) {
    if (error.isObject()) {
      auto stack = error.asObject(runtime).getProperty(runtime, "stack");
      if (stack.isString())
        return stack.asString(runtime).utf8(runtime);
    }
    return error.toString(runtime).utf8(runtime);
  }

  std::shared_ptr<const jsi::PreparedJavaScript> prepareBundle(jsi::Runtime& runtime, const std::string& source) {
    struct PreparedBundle {
      std::string source;
      std::shared_ptr<const jsi::PreparedJavaScript> script;
    };
    // runTest's mutex serializes access. Prepared bytecode can be shared across
    // Hermes runtimes; globals and native objects still belong to each runtime.
    static PreparedBundle cached;
    if (!cached.script || cached.source != source) {
      auto script = runtime.prepareJavaScript(std::make_shared<jsi::StringBuffer>(source), "runtime-tests.js");
      cached = {source, std::move(script)};
    }
    return cached.script;
  }

  uint32_t getTestTimeout(jsi::Runtime& runtime, const std::string& name, uint32_t defaultTimeoutMs) {
    auto getter = runtime.global().getProperty(runtime, "getNitroTestTimeoutMs");
    if (getter.isUndefined())
      return defaultTimeoutMs;
    auto timeout = getter.asObject(runtime).asFunction(runtime).call(runtime, jsi::String::createFromUtf8(runtime, name));
    if (timeout.isUndefined())
      return defaultTimeoutMs;
    if (!timeout.isNumber() || !std::isfinite(timeout.getNumber()) || timeout.getNumber() <= 0 ||
        timeout.getNumber() > std::numeric_limits<uint32_t>::max() || std::floor(timeout.getNumber()) != timeout.getNumber()) {
      throw std::runtime_error("getNitroTestTimeoutMs must return a positive uint32 timeout or undefined");
    }
    return static_cast<uint32_t>(timeout.getNumber());
  }

  std::string execute(const std::string& bundle, const std::string& name, uint32_t timeoutMs) {
    auto dispatcher = std::make_shared<TestDispatcher>();
    auto config = ::hermes::vm::RuntimeConfig::Builder()
                      .withMicrotaskQueue(true)
                      .withAsyncBreakCheckInEval(true)
                      .withES6BlockScoping(true)
                      .withCompilationMode(::hermes::vm::ForceEagerCompilation)
                      .build();
    auto runtime = facebook::hermes::makeHermesRuntime(config);
    struct Cleanup {
      std::shared_ptr<TestDispatcher> dispatcher;
      facebook::hermes::HermesRuntime& runtime;
      ~Cleanup() {
        dispatcher->close();
        runtime.unwatchTimeLimit();
      }
    } cleanup{dispatcher, *runtime};
    const char* phase = "preparing JS test bundle";
    // JSError owns JSI values. Convert it before destroying their runtime.
    try {
      // The watchdog interrupts JS execution, not the native compiler. Compile
      // once before timing setup, then evaluate in a fresh runtime for each case.
      auto prepared = prepareBundle(*runtime, bundle);
      phase = "loading JS test bundle";
      const auto timeout = std::chrono::milliseconds(timeoutMs);
      const auto timeoutMessage = "Timed out after " + std::to_string(timeoutMs) + "ms";
      const auto bundleDeadline = Clock::now() + timeout;
      runtime->watchTimeLimit(timeoutMs);
      install(*runtime, dispatcher);
      // The migrated tests need platform information and explicit collections,
      // without React Native's Platform module or development globals.
#ifdef __ANDROID__
      runtime->global().setProperty(*runtime, "__nitroTestPlatform", "android");
#else
      runtime->global().setProperty(*runtime, "__nitroTestPlatform", "ios");
#endif
      runtime->global().setProperty(
          *runtime, "gc",
          jsi::Function::createFromHostFunction(*runtime, jsi::PropNameID::forAscii(*runtime, "gc"), 0,
                                                [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value*, size_t) {
                                                  rt.instrumentation().collectGarbage("Nitro runtime test");
                                                  return jsi::Value::undefined();
                                                }));
      runtime->evaluatePreparedJavaScript(prepared);

      struct Result {
        bool done = false;
        std::string error;
      };
      auto result = std::make_shared<Result>();
      auto success = jsi::Function::createFromHostFunction(*runtime, jsi::PropNameID::forAscii(*runtime, "testPassed"), 0,
                                                           [result](jsi::Runtime&, const jsi::Value&, const jsi::Value*, size_t) {
                                                             result->done = true;
                                                             return jsi::Value::undefined();
                                                           });
      auto failure =
          jsi::Function::createFromHostFunction(*runtime, jsi::PropNameID::forAscii(*runtime, "testFailed"), 1,
                                                [result](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) {
                                                  result->done = true;
                                                  try {
                                                    result->error =
                                                        count == 0 ? "Test rejected without an error" : describeError(rt, args[0]);
                                                    if (result->error.empty())
                                                      result->error = "Test rejected with an empty error";
                                                  } catch (const std::exception& error) {
                                                    result->error = std::string("Could not describe JS rejection: ") + error.what();
                                                  } catch (...) {
                                                    result->error = "Could not describe JS rejection";
                                                  }
                                                  return jsi::Value::undefined();
                                                });
      auto run = runtime->global().getPropertyAsFunction(*runtime, "runNitroTest");
      const auto testTimeoutMs = getTestTimeout(*runtime, name, timeoutMs);
      // Stop setup's watchdog before checking elapsed time so an expired
      // interrupt cannot carry over when the execution deadline is reset.
      runtime->unwatchTimeLimit();
      if (Clock::now() >= bundleDeadline)
        throw std::runtime_error(timeoutMessage);

      phase = "running JS test";
      const auto testTimeoutMessage = "Timed out after " + std::to_string(testTimeoutMs) + "ms";
      const auto deadline = Clock::now() + std::chrono::milliseconds(testTimeoutMs);
      runtime->watchTimeLimit(testTimeoutMs);
      auto promise = run.call(*runtime, jsi::String::createFromUtf8(*runtime, name)).asObject(*runtime);
      promise.getPropertyAsFunction(*runtime, "then").callWithThis(*runtime, promise, success, failure);

      while (!result->done) {
        if (Clock::now() >= deadline)
          throw std::runtime_error(testTimeoutMessage);
        const bool drained = runtime->drainMicrotasks(128);
        if (!result->done && drained)
          dispatcher->tick(deadline);
      }
      runtime->unwatchTimeLimit();
      if (Clock::now() >= deadline)
        throw std::runtime_error(testTimeoutMessage);
      return result->error;
    } catch (const std::exception& error) {
      std::string message = error.what();
      return std::string("While ") + phase + ": " + (message.empty() ? "Native exception without a message" : message);
    } catch (...) {
      return std::string("While ") + phase + ": unknown native exception";
    }
  }
} // namespace

std::string runTest(const std::string& bundle, const std::string& name, uint32_t timeoutMs) {
  // Nitro's process-wide registries/caches currently assume serialized runtimes.
  static std::mutex runtimeMutex;
  std::lock_guard lock(runtimeMutex);
  try {
    auto error = execute(bundle, name, timeoutMs);
    return error.empty() ? "" : name + ": " + error;
  } catch (const std::exception& error) {
    return name + ": " + error.what();
  } catch (...) {
    return name + ": unknown native exception";
  }
}
} // namespace margelo::nitro::testing
