//
//  SwiftClosure.swift
//  NitroModules
//
//  Created by Marc Rousavy on 14.08.24.
//

/// Wraps a Swift closure in a Swift class.
/// This can be used to create unmanaged pointers (`void*`) and
/// passed to C-style function pointers via `void* context` parameters.
private final class ClosureWrapper {
  private let closure: () -> Void

  init(closure: @escaping () -> Void) {
    self.closure = closure
  }

  func invoke() {
    closure()
  }
}

/// Represents a Swift Closure that can be called from both C++ and Swift.
public typealias SwiftClosure = margelo.nitro.SwiftClosure

extension SwiftClosure {
  /**
   * Create a new `SwiftClosure` wrapping the given Swift closure.
   * This can then be called from both C++ and Swift.
   */
  public init(wrappingClosure closure: @escaping () -> Void) {
    // Wrap closure in void*, and increment its ref count so it stays alive.
    let context = Unmanaged.passRetained(ClosureWrapper(closure: closure)).toOpaque()

    // Create a C-style Function Pointer, which calls the actual Swift closure.
    func call(context: UnsafeMutableRawPointer) {
      // Unwrap context from void* to closure again. We are assuming that it has not been deleted yet.
      let closure = Unmanaged<ClosureWrapper>.fromOpaque(context).takeUnretainedValue()
      // Call it!
      closure.invoke()
    }

    // Create a C-style Function Pointer, which deletes the `ClosureWrapper`.
    func destroy(context: UnsafeMutableRawPointer) {
      // Release the void* holding our `ClosureWrapper`
      Unmanaged<ClosureWrapper>.fromOpaque(context).release()
    }

    self.init(context, call, destroy)
  }
}
