//
//  RuntimeError.swift
//  NitroModules
//
//  Created by Marc Rousavy on 17.07.24.
//

import Foundation

/// Represents an error that occured at any point during the application's runtime.
///
/// Throw this error in Nitro Modules to provide clear and concise error messages to JS.
@frozen
public enum RuntimeError: LocalizedError, CustomStringConvertible {
  case error(withMessage: String)

  public var description: String {
    switch self {
    case .error(let message): return message
    }
  }

  public var errorDescription: String? {
    return description
  }

  /**
   * Creates a new `RuntimeError` with the given `message`.
   */
  public init(_ message: String) {
    self = .error(withMessage: message)
  }

  /**
   * Creates a new `RuntimeError` from the given C++ `std::exception`.
   */
  public static func from(cppError: std.exception_ptr) -> RuntimeError {
    let message = margelo.nitro.getExceptionMessage(cppError)
    return .error(withMessage: String(message))
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
