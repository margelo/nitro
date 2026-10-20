//
//  Callback.swift
//  NitroModules
//
//  Created by Marc Rousavy on 20.09.26.
//

/// A borrowed/inline Callback to either JS or native.
///
/// `InlineCallback` is non-escapable, meaning it can only be called inline within the
/// scope of the calling function. Call `escape()` to store it or call it later.
public protocol InlineCallback<Arguments, Return>: ~Copyable, ~Escapable {
  associatedtype Arguments
  associatedtype Return
  associatedtype Escaped: Callback<Arguments, Return>

  /// Invokes this callback synchronously, throwing if the callback fails.
  func callAsFunction(_ arguments: Arguments) throws -> Return
  /// Retains this callback as a `Callback` that can be stored or called later.
  func escape() -> Escaped
}
extension InlineCallback where Self: ~Copyable & ~Escapable {
  public func callAsFunction<each A>(_ args: repeat each A) throws -> Return
  where Arguments == (repeat each A) {
    return try callAsFunction((repeat each args))
  }
}

/// A Callback to either JS or native.
///
/// Unlike `InlineCallback`, `Callback` is escapable, meaning it can be called
/// "later", e.g. stored as a class member and invoked at a later point in time.
///
/// `Callback` can be invoked sync (which has to be called on the JS Runtime
/// context/Thread) or async (which returns a `Promise<T>` and uses the `Dispatcher`)
///
/// Create a native callback with `.native { ... }` using a signature from your
/// Nitrogen specs, for example:
/// ```swift
/// let callback: any Callback<Double, Void> = .native { value in
///   print(value)
/// }
/// ```
public protocol Callback<Arguments, Return> {
  associatedtype Arguments
  associatedtype Return
  associatedtype AsyncResult: Promise<Return>

  /// Invokes this callback synchronously, throwing if the callback fails.
  func callSync(_ arguments: Arguments) throws -> Return
  func callAsync(_ arguments: Arguments) -> AsyncResult
  func callAndForget(_ arguments: Arguments)
}

/// Extension to spread out the single tuple-argument into separate parameters
extension Callback {
  public func callSync<each A>(_ args: repeat each A) throws -> Return
  where Arguments == (repeat each A) {
    return try callSync((repeat each args))
  }
  public func callAsync<each A>(_ args: repeat each A) -> AsyncResult
  where Arguments == (repeat each A) {
    return callAsync((repeat each args))
  }
  public func callAndForget<each A>(_ args: repeat each A) where Arguments == (repeat each A) {
    callAndForget((repeat each args))
  }
}

/// Extension to support Swift `async`
extension Callback {
  public func callAsync<each A>(_ args: repeat each A) async throws -> Return
  where Arguments == (repeat each A) {
    return try await callAsync((repeat each args)).await()
  }
}

/// Extension to support callAsFunction() which returns a `Promise` if it has a return type
extension Callback {
  public func callAsFunction<each A>(_ args: repeat each A) -> AsyncResult
  where Arguments == (repeat each A) {
    return callAsync((repeat each args))
  }
}
/// Extension to support callAsFunction() which returns `Void` if it doesn't have a return type
extension Callback where Return == Void {
  public func callAsFunction<each A>(_ args: repeat each A) where Arguments == (repeat each A) {
    callAndForget((repeat each args))
  }
}
