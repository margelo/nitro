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
///
/// The C++ bridge synchronizes the promise's settlement and listener storage.
/// Its Sendable handle does not protect mutable state inside T. Native listeners
/// receiving non-Sendable results must arrange safe access to those values.
public protocol Promise<T>: Sendable {
  associatedtype T

  func resolve(result: T)
  func reject(error: Error)

  /// Runs on the resolving thread, or immediately if already resolved.
  func addOnResolvedListener(_: @escaping @Sendable (T) -> Void)
  /// Runs on the rejecting thread, or immediately if already rejected.
  func addOnRejectedListener(_: @escaping @Sendable (Error) -> Void)
}

/// Conformance imported from the C++ `Promise<T>` declaration.
public protocol CxxPromise<T>: Promise {}

extension Promise where T == Void {
  public func resolve() {
    self.resolve(result: ())
  }
  public func addOnResolvedListener(_ listener: @escaping @Sendable () -> Void) {
    self.addOnResolvedListener { _ in listener() }
  }
}

extension Promise where T: Sendable {
  /**
   * Asynchronously await the result of the Promise.
   * If the Promise is already resolved/rejected, this will continue immediately,
   * otherwise it will asynchronously wait for a result or throw on a rejection.
   *
   * The result must be Sendable because a Promise can deliver the same value to
   * multiple observers on different threads. Its internal lock protects settlement,
   * not the mutable state of an object stored in the result.
   */
  public nonisolated(nonsending) func `await`() async throws -> T {
    return try await withCheckedThrowingContinuation { continuation in
      self.addOnResolvedListener { result in
        continuation.resume(returning: result)
      }
      self.addOnRejectedListener { error in
        continuation.resume(throwing: error)
      }
    }
  }
}
