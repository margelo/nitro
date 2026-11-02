#include "TestRuntime.hpp"

#ifdef __ANDROID__
#include <fbjni/fbjni.h>
#endif

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
    bool isOnDispatcher() override {
      return std::this_thread::get_id() == owner;
    }

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

    // Run work already queued by the completed case before starting the next.
    bool runQueued() {
      std::function<void()> task;
      {
        std::lock_guard lock(mutex);
        if (tasks.empty())
          return false;
        task = std::move(tasks.front());
        tasks.pop();
      }
      task();
      return true;
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
    // Only compilation and cache replacement are serialized. Bytecode is shared across
    // Hermes runtimes; globals and native objects still belong to each runtime.
    static PreparedBundle cached;
    static std::mutex cacheMutex;
    std::lock_guard lock(cacheMutex);
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

  std::string execute(const std::string& bundle, const std::vector<std::string>& names, uint32_t timeoutMs,
                      const std::function<void()>& onTestStarted) {
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
    std::string currentName = names.front();
    // JSError owns JSI values. Convert it before destroying their runtime.
    try {
      // The watchdog interrupts JS execution, not the native compiler. Compile
      // once before timing JS, then evaluate in a fresh runtime for each file.
      auto prepared = prepareBundle(*runtime, bundle);
      phase = "installing Nitro";
      install(*runtime, dispatcher);
      // Expose platform information and explicit garbage collection to the tests.
#ifdef __ANDROID__
      runtime->global().setProperty(*runtime, "__nitroTestPlatform", "android");
#else
      runtime->global().setProperty(*runtime, "__nitroTestPlatform", "apple");
#endif
      runtime->global().setProperty(
          *runtime, "gc",
          jsi::Function::createFromHostFunction(*runtime, jsi::PropNameID::forAscii(*runtime, "gc"), 0,
                                                [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value*, size_t) {
                                                  rt.instrumentation().collectGarbage("Nitro runtime test");
                                                  return jsi::Value::undefined();
                                                }));
      // JSI may destroy a native function's state on any thread, e.g. Hermes' concurrent GC thread.
      // This takes that state out of the function and destroys it on a new thread right away. On
      // Android, that thread is not attached to the JVM, like Hermes' GC thread.
      runtime->global().setProperty(
          *runtime, "destroyOnBackgroundThread",
          jsi::Function::createFromHostFunction(*runtime, jsi::PropNameID::forAscii(*runtime, "destroyOnBackgroundThread"), 1,
                                                [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value* args, size_t count) {
                                                  if (count != 1 || !args[0].isObject() || !args[0].getObject(rt).isFunction(rt))
                                                    throw jsi::JSError(rt, "destroyOnBackgroundThread(...) expects a function");
                                                  jsi::Function function = args[0].getObject(rt).getFunction(rt);
                                                  if (!function.isHostFunction(rt))
                                                    throw jsi::JSError(rt, "destroyOnBackgroundThread(...) expects a native function");
                                                  jsi::HostFunctionType state = std::move(function.getHostFunction(rt));
                                                  std::thread([state = std::move(state)]() mutable { state = nullptr; }).join();
                                                  return jsi::Value::undefined();
                                                }));
      phase = "loading JS test bundle";
      const auto timeout = std::chrono::milliseconds(timeoutMs);
      const auto timeoutMessage = "Timed out after " + std::to_string(timeoutMs) + "ms";
      const auto bundleDeadline = Clock::now() + timeout;
      runtime->watchTimeLimit(timeoutMs);
      runtime->evaluatePreparedJavaScript(prepared);

      // Give bundle evaluation and each case their own JS execution budgets.
      runtime->unwatchTimeLimit();
      if (Clock::now() >= bundleDeadline)
        throw std::runtime_error(timeoutMessage);

      for (const auto& name : names) {
        currentName = name;
        phase = "running JS test";
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
        runtime->watchTimeLimit(timeoutMs);
        const auto testTimeoutMs = getTestTimeout(*runtime, name, timeoutMs);
        runtime->unwatchTimeLimit();
        if (onTestStarted)
          onTestStarted();
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
        if (Clock::now() >= deadline)
          throw std::runtime_error(testTimeoutMessage);
        if (!result->error.empty())
          return name + ": " + result->error;

        phase = "settling work queued by the JS test";
        while (true) {
          if (Clock::now() >= deadline)
            throw std::runtime_error(testTimeoutMessage);
          const bool drained = runtime->drainMicrotasks(128);
          if (!dispatcher->runQueued() && drained)
            break;
        }
        runtime->unwatchTimeLimit();
      }
      return "";
    } catch (const std::exception& error) {
      std::string message = error.what();
      return currentName + ": While " + phase + ": " + (message.empty() ? "Native exception without a message" : message);
    } catch (...) {
      return currentName + ": While " + phase + ": unknown native exception";
    }
  }
} // namespace

std::string runSuite(const std::string& bundle, const std::vector<std::string>& names, uint32_t timeoutMs,
                     const std::function<void()>& onTestStarted) {
  if (names.empty())
    return "Cannot run an empty JavaScript test suite";
  try {
#ifdef __ANDROID__
    // The host owns JNI attachment for the whole runtime lifetime, including
    // dispatcher callbacks, microtasks and teardown.
    std::string error;
    facebook::jni::ThreadScope::WithClassLoader([&] { error = execute(bundle, names, timeoutMs, onTestStarted); });
    return error;
#else
    return execute(bundle, names, timeoutMs, onTestStarted);
#endif
  } catch (const std::exception& error) {
    return names.front() + ": " + error.what();
  } catch (...) {
    return names.front() + ": unknown native exception";
  }
}

} // namespace margelo::nitro::testing
