//
//  Promise.swift
//  NitroModules
//
//  Created by Marc Rousavy on 15.08.24.
//

import Foundation

/// Represents a Promise that can be passed to JS.
///
/// Create a new Promise with the following APIs:
/// - `Promise<T>.async { ... }` - Creates a new Promise that runs the given code in a Swift `async`/`await` Task.
/// - `Promise<T>.parallel { ... }` - Creates a new Promise that runs the given code in a parallel `DispatchQueue`.
/// - `Promise<T>.resolved(withResult:)` - Creates a new already resolved Promise.
/// - `Promise<T>.rejected(withError:)` - Creates a new already rejected Promise.
/// - `Promise<T>()` - Creates a new Promise with fully manual control over the `resolve(..)`/`reject(..)` functions.
public final class Promise<T>: @unchecked Sendable {
  private enum State {
    case result(T)
    case error(Error)
  }

  private let lock = NSLock()
  private var state: State?
  private var onResolvedListeners: [(T) -> Void] = []
  private var onRejectedListeners: [(Error) -> Void] = []

  private func withLock<Result>(_ operation: () throws -> Result) rethrows -> Result {
    lock.lock()
    defer { lock.unlock() }
    return try operation()
  }

  /**
   * Create a new pending Promise.
   * It can (and must) be resolved **or** rejected later.
   */
  public init() {
    state = nil
  }

  deinit {
    let isPending = withLock { state == nil }

    if isPending {
      let message = "Timeouted: Promise<\(String(describing: T.self))> was destroyed!"
      reject(withError: RuntimeError.error(withMessage: message))
    }
  }

  /**
   * Resolves this `Promise<T>` with the given `T` and notifies all listeners.
   */
  public func resolve(withResult result: T) {
    let listeners = withLock {
      // Ensure we haven't resolved/rejected yet
      guard state == nil else {
        fatalError(
          "Failed to resolve promise with \(result) - it has already been resolved or rejected!")
      }

      // Resolve + pop listeners under lock
      state = .result(result)
      let listeners = onResolvedListeners
      onResolvedListeners.removeAll()
      onRejectedListeners.removeAll()
      return listeners
    }

    listeners.forEach { listener in listener(result) }
  }

  /**
   * Rejects this `Promise<T>` with the given `Error` and notifies all listeners.
   */
  public func reject(withError error: Error) {
    let listeners = withLock {
      // Ensure we haven't resolved/rejected yet
      guard state == nil else {
        fatalError(
          "Failed to reject promise with \(error) - it has already been resolved or rejected!")
      }

      // Reject + pop listeners under lock
      state = .error(error)
      let listeners = onRejectedListeners
      onResolvedListeners.removeAll()
      onRejectedListeners.removeAll()
      return listeners
    }

    listeners.forEach { listener in listener(error) }
  }
}

/// Extensions to easily create new Promises.
extension Promise {
  /**
   * Create a new `Promise<T>` already resolved with the given `T`.
   */
  public static func resolved(withResult result: T) -> Promise {
    let promise = Promise()
    promise.state = .result(result)
    return promise
  }

  /**
   * Create a new `Promise<T>` already rejected with the given `Error`.
   */
  public static func rejected(withError error: Error) -> Promise {
    let promise = Promise()
    promise.state = .error(error)
    return promise
  }

  /**
   * Create a new `Promise<T>` that runs the given `async` code in a `Task`.
   * This does not necessarily run the code in a different Thread, but supports Swift's `async`/`await`.
   */
  public static func `async`(
    _ priority: TaskPriority? = nil,
    _ run: sending @escaping @isolated(any) () async throws -> T
  ) -> Promise {
    let promise = Promise()
    Task(priority: priority) {
      do {
        let result = try await run()
        promise.resolve(withResult: result)
      } catch {
        promise.reject(withError: error)
      }
    }
    return promise
  }

  /**
   * Create a new `Promise<T>` that runs the given `run` function on a parallel Thread/`DispatchQueue`.
   */
  @preconcurrency
  public static func parallel(
    _ queue: DispatchQueue = .global(),
    _ run: @escaping @Sendable () throws -> T
  ) -> Promise {
    let promise = Promise()
    queue.async {
      do {
        let result = try run()
        promise.resolve(withResult: result)
      } catch {
        promise.reject(withError: error)
      }
    }
    return promise
  }
}

/// Void overloads to avoid typing out `()`
extension Promise where T == Void {
  /**
   * Resolves this `Promise<Void>`.
   */
  public func resolve() {
    return self.resolve(withResult: ())
  }
  /**
   * Create an already resolved `Promise<Void>`.
   */
  public static func resolved() -> Promise {
    return Self.resolved(withResult: ())
  }
}

/// Extensions to support then/catch syntax.
extension Promise {
  /**
   * Add a continuation listener to this `Promise<T>`.
   * Once the `Promise<T>` resolves, the `onResolvedListener` will be called.
   */
  @discardableResult
  public func then(_ onResolvedListener: @escaping (T) -> Void) -> Promise {
    let currentResult = withLock { () -> T? in
      switch state {
      case .result(let result):
        // Return current result if it has already been resolved
        return result
      case .error:
        return nil
      case nil:
        // Add resolved listener potentially for later
        onResolvedListeners.append(onResolvedListener)
        return nil
      }
    }

    if let currentResult {
      // If it already has been resolved, we call the callback now (outside of `withLock`)
      onResolvedListener(currentResult)
    }
    return self
  }

  /**
   * Add an error continuation listener to this `Promise<T>`.
   * Once the `Promise<T>` rejects, the `onRejectedListener` will be called with the error.
   */
  @discardableResult
  public func `catch`(_ onRejectedListener: @escaping (Error) -> Void) -> Promise {
    let currentError = withLock { () -> Error? in
      switch state {
      case .error(let error):
        // Return current error if it has already been rejected
        return error
      case .result:
        return nil
      case nil:
        // Add rejected listener potentially for later
        onRejectedListeners.append(onRejectedListener)
        return nil
      }
    }

    if let currentError {
      // If it already has been rejected, we call the callback now (outside of `withLock`)
      onRejectedListener(currentError)
    }
    return self
  }
}

/// Extensions to support await syntax.
extension Promise {
  /**
   * Asynchronously await the result of the Promise.
   * If the Promise is already resolved/rejected, this will continue immediately,
   * otherwise it will asynchronously wait for a result or throw on a rejection.
   */
  public func `await`() async throws -> T {
    return try await withUnsafeThrowingContinuation { continuation in
      self.then { result in
        continuation.resume(returning: result)
      }.catch { error in
        continuation.resume(throwing: error)
      }
    }
  }
}
