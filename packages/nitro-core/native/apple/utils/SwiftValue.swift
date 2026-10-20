public import NitroModulesAppleCxx

/// Copies a value from borrowed Swift storage. The source must contain an initialized T.
@_expose(Cxx)
public func copySwiftValue<T>(_ source: UnsafeRawPointer) -> T {
  return source.load(as: T.self)
}

/// Initializes Swift-owned storage that is bound to T, aligned, and uninitialized.
/// The destination must not overlap the borrowed source value.
@_expose(Cxx)
public func initializeSwiftValue<T>(_ destination: UnsafeMutableRawPointer, _ value: borrowing T) {
  withUnsafePointer(to: value) { source in
    destination.assumingMemoryBound(to: T.self).initialize(from: source, count: 1)
  }
}

/// Borrows a value's Swift representation for the duration of the consumer call.
@_expose(Cxx)
public func withSwiftValue<T>(_ value: borrowing T, _ consumer: margelo.nitro.SwiftValueConsumer) {
  withUnsafePointer(to: value) { pointer in
    consumer(pointer)
  }
}

/// The initializer must initialize exactly one T before returning.
@_expose(Cxx)
public func makeSwiftValue<T>(_ initializer: margelo.nitro.SwiftValueInitializer) -> T {
  return withUnsafeTemporaryAllocation(of: T.self, capacity: 1) { storage in
    initializer(storage.baseAddress!)
    return storage.baseAddress!.move()
  }
}

/// Returning false leaves the storage uninitialized; returning true initializes exactly one T.
@_expose(Cxx)
public func tryMakeSwiftValue<T>(_ initializer: margelo.nitro.SwiftValueTryInitializer) -> T? {
  return withUnsafeTemporaryAllocation(of: T.self, capacity: 1) { storage in
    let didInitialize = initializer(storage.baseAddress!)
    guard didInitialize else { return nil }
    return storage.baseAddress!.move()
  }
}
