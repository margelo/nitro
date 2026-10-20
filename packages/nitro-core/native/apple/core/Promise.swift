//
//  Promise.swift
//  NitroModules
//
//  Created by Marc Rousavy on 15.08.24.
//

/// Represents a JS `Promise`.
///
/// Users should initialize specializations of the C++ `Promise<T>`
/// that conform to this Swift `Promise<T>` protocol.
///
/// The recommended API to create Promises is via `.async { ... }`.
public protocol Promise<T>: Sendable {
  associatedtype T

  func resolve(result: T)
  func reject(error: Error)

  /// Runs on the resolving thread, or immediately if already resolved.
  func addOnResolvedListener(_: @escaping @Sendable (T) -> Void)
  /// Runs on the rejecting thread, or immediately if already rejected.
  func addOnRejectedListener(_: @escaping @Sendable (Error) -> Void)
}

extension Promise where T == Void {
  public func resolve() {
    self.resolve(result: ())
  }
  public func addOnResolvedListener(_ listener: @escaping @Sendable () -> Void) {
    self.addOnResolvedListener { _ in listener() }
  }
}

extension Promise {
  /**
   * Asynchronously await the result of the Promise.
   * If the Promise is already resolved/rejected, this will continue immediately,
   * otherwise it will asynchronously wait for a result or throw on a rejection.
   */
  public func `await`() async throws -> T {
    return try await withUnsafeThrowingContinuation { continuation in
      self.addOnResolvedListener { result in
        continuation.resume(returning: result)
      }
      self.addOnRejectedListener { error in
        continuation.resume(throwing: error)
      }
    }
  }
}
