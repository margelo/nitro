//
//  RuntimeError.swift
//  NitroModules
//
//  Created by Marc Rousavy on 17.07.24.
//

public import CxxStdlib
public import Foundation
internal import NitroModulesAppleCxx

/// Represents an error that occurred at any point during the application's runtime.
///
/// Throw this error in Nitro Modules to provide clear and concise error messages to JS.
@frozen
public struct RuntimeError: LocalizedError, CustomStringConvertible {
  /// The message describing this error.
  public let message: String

  public var description: String {
    return message
  }

  public var errorDescription: String? {
    return description
  }

  /**
   * Creates a new `RuntimeError` with the given `message`.
   */
  public init(_ message: String) {
    self.message = message
  }

  /**
   * Creates a new `RuntimeError` from the given C++ `std::exception`.
   */
  public static func from(cppError: std.exception_ptr) -> RuntimeError {
    let message = margelo.nitro.getExceptionMessage(cppError)
    return RuntimeError(String(message))
  }
}

extension Error {
  /**
   * Converts this `Error` to a C++ `std::exception`.
   */
  public func toCpp() -> std.exception_ptr {
    let message = String(describing: self)
    return margelo.nitro.makeException(std.string(message))
  }
}
