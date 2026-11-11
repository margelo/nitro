//
//  ThreadPool.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 21.06.24.
//

#pragma once

#include "NitroDefines.hpp"
#include <atomic>
#include <condition_variable>
#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <thread>
#include <vector>

namespace margelo::nitro {

class ThreadPool final {
public:
  /**
   * Create a new ThreadPool with the given number of minimum workers/threads.
   * The Thread Pool can expand on the fly if it is busy.
   */
  explicit ThreadPool(const char* NON_NULL const name, size_t initialThreadsCount, size_t maxThreadsCount);
  ~ThreadPool();
  ThreadPool(const ThreadPool&) = delete;
  ThreadPool(ThreadPool&&) = delete;

  /**
   * Schedules the given task asynchronously on the ThreadPool.
   * It will run once a worker is available.
   */
  void run(std::function<void()>&& task);

private:
  /**
   * Adds a new Thread to the current Thread Pool.
   * This grows the size by one, and potentially starts work sooner if other Threads are busy.
   */
  void addThread(std::unique_lock<std::mutex>& queueMutexLock);

public:
  /**
   * Get a static singleton instance - a shared ThreadPool.
   * The shared ThreadPool has 3 threads.
   */
  static ThreadPool& shared();

private:
  std::vector<std::thread> _workers;
  std::queue<std::function<void()>> _tasks;
  std::mutex _queueMutex;
  std::condition_variable _condition;
  std::atomic<bool> _isAlive;
  std::atomic<size_t> _threadCount;
  size_t _threadCountLimit;
  const char* NON_NULL _name;
  static constexpr auto TAG = "ThreadPool";
};

} // namespace margelo::nitro
