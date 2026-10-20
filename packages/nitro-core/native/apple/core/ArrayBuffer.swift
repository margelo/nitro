//
//  ArrayBuffer.swift
//  NitroModules
//
//  Created by Marc Rousavy on 17.07.24.
//

internal import CxxStdlib
public import Foundation
public import NitroModulesAppleCxx

public typealias ArrayBuffer = margelo.nitro.ArrayBuffer

// Use the C++ operator to compare backing handles without accessing their bytes.
extension ArrayBuffer: @retroactive Equatable {}

extension ArrayBuffer {
  public var size: Int {
    return self.__size()
  }
  public var data: UnsafeMutablePointer<UInt8>? {
    return self.__dataUnsafe()
  }
  public var isOwner: Bool {
    return self.__isOwner()
  }
}

// pragma MARK: Bytes

extension ArrayBuffer {
  /// Calls `body` once with a read-only view of the buffer's bytes, without copying them.
  /// The pointer must not escape `body`.
  /// JS-backed buffers must be accessed synchronously on the JS Runtime Thread, and their
  /// storage must remain valid throughout `body`. Call `asOwning()` on that thread before
  /// accessing the bytes elsewhere.
  public func withUnsafeBytes<R>(_ body: (UnsafeRawBufferPointer) throws -> R) rethrows -> R {
    return try withUnsafeMutableBytes { bytes in
      try body(UnsafeRawBufferPointer(bytes))
    }
  }

  /// Calls `body` once with a mutable view of the buffer's bytes, without copying them.
  /// The pointer must not escape `body`. Writes affect all references to the same storage,
  /// and access is not synchronized.
  /// JS-backed buffers must be accessed synchronously on the JS Runtime Thread, and their
  /// storage must remain valid throughout `body`. Call `asOwning()` on that thread before
  /// accessing the bytes elsewhere.
  public func withUnsafeMutableBytes<R>(_ body: (UnsafeMutableRawBufferPointer) throws -> R)
    rethrows -> R
  {
    return try withExtendedLifetime(self) {
      try body(UnsafeMutableRawBufferPointer(start: self.data, count: self.size))
    }
  }
}

// pragma MARK: Wrap

extension ArrayBuffer {
  /**
   * Create a new `ArrayBuffer` that wraps the given `data` of the given `size`
   * without performing a copy.
   * The caller must keep the bytes valid until `onDelete` runs after the last shared wrapper is released.
   * The closure can free the bytes directly or capture an owner whose release handles cleanup.
   * Use `ArrayBuffer.empty()` when there are no bytes to wrap.
   */
  public static func wrap(
    dataWithoutCopy data: UnsafeMutablePointer<UInt8>,
    size: Int,
    onDelete delete: @escaping () -> Void
  ) -> ArrayBuffer {
    precondition(size >= 0, "ArrayBuffer size must not be negative.")
    return ArrayBuffer.wrap(
      data, size,
      consuming: .init({
        delete()
      }))
  }

  /**
   * Create a new `ArrayBuffer` that wraps the given `data` of the given `size`
   * without performing a copy.
   * The caller must keep the bytes valid until `onDelete` runs after the last shared wrapper is released.
   * The closure can free the bytes directly or capture an owner whose release handles cleanup.
   * Use `ArrayBuffer.empty()` when there are no bytes to wrap.
   */
  public static func wrap(
    dataWithoutCopy data: UnsafeMutableRawPointer,
    size: Int,
    onDelete delete: @escaping () -> Void
  ) -> ArrayBuffer {
    return ArrayBuffer.wrap(
      dataWithoutCopy: data.assumingMemoryBound(to: UInt8.self),
      size: size,
      onDelete: consume delete)
  }
}

// pragma MARK: Copy

extension ArrayBuffer {
  /**
   * Copy the given `Data` into a new **owning** `ArrayBuffer`.
   */
  public static func copy(data: Data) throws -> ArrayBuffer {
    if data.isEmpty {
      return ArrayBuffer.empty()
    }
    return try data.withUnsafeBytes { rawPointer in
      guard let baseAddress = rawPointer.baseAddress else {
        throw RuntimeError("Cannot get baseAddress of Data!")
      }
      let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
      return ArrayBuffer.copy(bytes, data.count)
    }
  }
}

// pragma MARK: Data

extension ArrayBuffer {
  /**
   * Wrap this `ArrayBuffer` in a `Data` instance, without performing a copy.
   * - `copyIfNeeded`: If this `ArrayBuffer` is **non-owning**, the foreign
   *                   data may needs to be copied to be safely used outside of the scope of the caller function.
   *                   This flag controls that.
   */
  public func toData(copyIfNeeded: Bool) -> Data {
    if copyIfNeeded && !self.isOwner {
      return withUnsafeBytes { Data($0) }
    }
    let size = self.size
    if size == 0 {
      return Data()
    }
    guard let data = self.data else {
      preconditionFailure("Non-empty ArrayBuffers require a valid data pointer.")
    }
    return Data(
      bytesNoCopy: data, count: size,
      deallocator: .custom({ buffer, size in
        withExtendedLifetime(self) {}
      }))
  }
}
