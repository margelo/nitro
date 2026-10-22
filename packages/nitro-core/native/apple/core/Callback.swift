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

/// A generated module's borrowing facade for a C++ `InlineCallback<R(Args...)>`,
/// with its conformance declared on the C++ facade.
///
/// Generated Swift extensions provide the `__nitro` adapter witness.
public protocol CxxInlineCallback<Arguments, Return>: InlineCallback, ~Copyable, ~Escapable {
  func __nitroCall(_ arguments: Arguments) throws -> Return
}

extension CxxInlineCallback where Self: ~Copyable & ~Escapable {
  @inlinable
  public func callAsFunction(_ arguments: Arguments) throws -> Return {
    return try __nitroCall(arguments)
  }
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
/// JS callbacks run on their originating runtime's dispatcher. `callSync` requires
/// the caller to already be on that dispatcher. `callAsync` and `callAndForget`
/// schedule JS execution there. Native callbacks run immediately on the calling
/// thread for all three methods.
///
/// Callback handles can be shared across threads. Native closures must be Sendable;
/// callers must still synchronize access to mutable arguments and results.
///
/// Create a native callback with `.native { ... }` using a signature from your
/// Nitrogen specs, for example:
/// ```swift
/// let callback: any Callback<Double, Void> = .native { value in
///   print(value)
/// }
/// ```
public protocol Callback<Arguments, Return>: Sendable {
  associatedtype Arguments
  associatedtype Return
  associatedtype AsyncResult: Promise<Return>

  /// Invokes this callback synchronously, throwing if the callback fails.
  func callSync(_ arguments: Arguments) throws -> Return
  func callAsync(_ arguments: Arguments) -> AsyncResult
  func callAndForget(_ arguments: Arguments)
}

/// A C++ `Callback<R(Args...)>` specialization with its conformance declared by Nitro core.
///
/// Generated Swift extensions provide the `__nitro` adapter witnesses. The public
/// operations live here, so importing several generated modules does not duplicate them.
public protocol CxxCallback<Arguments, Return>: Callback {
  func __nitroCallSync(_ arguments: Arguments) throws -> Return
  func __nitroCallAsync(_ arguments: Arguments) -> AsyncResult
  func __nitroCallAndForget(_ arguments: Arguments)
}

extension CxxCallback {
  @inlinable
  public func callSync(_ arguments: Arguments) throws -> Return {
    return try __nitroCallSync(arguments)
  }
  @inlinable
  public func callAsync(_ arguments: Arguments) -> AsyncResult {
    return __nitroCallAsync(arguments)
  }
  @inlinable
  public func callAndForget(_ arguments: Arguments) {
    __nitroCallAndForget(arguments)
  }
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
extension Callback where Return: Sendable {
  public nonisolated(nonsending) func callAsync<each A>(_ args: repeat each A) async throws -> Return where Arguments == (repeat each A) {
    return try await callAsync((repeat each args)).await()
  }

  /// Invokes this callback and awaits its result, throwing if the callback fails.
  public nonisolated(nonsending) func callAsFunction<each A>(_ args: repeat each A) async throws -> Return
  where Arguments == (repeat each A) {
    return try await callAsync(repeat each args)
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

  public nonisolated(nonsending) func callAsFunction<each A>(_ args: repeat each A) async throws where Arguments == (repeat each A) {
    try await callAsync((repeat each args)).await()
  }
}
