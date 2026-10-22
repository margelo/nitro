//
//  DirectCall.swift
//  NitroModules
//
//  Helpers for the Swift entry points Nitrogen generates for direct JSI host functions.
//  See `DirectCall.hpp`.
//

internal import NitroModulesCxx

/// Creates a Swift `String` from the characters a generated direct entry point receives.
/// `data` points to `length` ASCII bytes if `isASCII`, otherwise to `length` UTF-16 code units.
@inlinable
public func nitroDirectString(_ data: UnsafeRawPointer?, _ length: Int, _ isASCII: Bool) -> String {
  if isASCII {
    return String(
      decoding: UnsafeBufferPointer(start: data?.assumingMemoryBound(to: UInt8.self), count: length), as: UTF8.self)
  }
  return String(
    decoding: UnsafeBufferPointer(start: data?.assumingMemoryBound(to: UInt16.self), count: length), as: UTF16.self)
}

/// Stores the string result of a generated direct entry point in `target`, as UTF-8.
@inlinable
public func nitroDirectSetString(_ target: UnsafeMutableRawPointer, _ value: String) {
  var value = value
  value.withUTF8 { bytes in
    nitroDirectSetStringFromUTF8(target, bytes.baseAddress, bytes.count)
  }
}

@usableFromInline
func nitroDirectSetStringFromUTF8(_ target: UnsafeMutableRawPointer, _ bytes: UnsafePointer<UInt8>?, _ count: Int) {
  nitro_direct_set_string(target, bytes, count)
}

/// Reports `error` from a generated direct entry point in `target`.
public func nitroDirectSetError(_ target: UnsafeMutableRawPointer, _ error: any Error) {
  let message = String(describing: error)
  message.withCString { nitro_direct_set_error(target, $0) }
}
