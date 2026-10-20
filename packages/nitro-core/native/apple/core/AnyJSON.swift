//
//  AnyJSON.swift
//  NitroModules
//
//  Created by Marc Rousavy on 02.10.26.
//

public import Foundation
public import NitroModulesAppleCxx

/// Equality compares the encoded JSON bytes, including key order and whitespace.
@_expose(Cxx)
public struct AnyJSON: Equatable, Hashable, Sendable {
  /// The encoded UTF-8 JSON data, stored without validation.
  public let data: Data

  /// Creates a JSON value from already encoded UTF-8 JSON data.
  /// The data is stored without validating or re-encoding it.
  public init(data: Data) {
    self.data = data
  }

  public init(bytes: UnsafePointer<UInt8>, length: Int) {
    self.data = Data(bytes: bytes, count: length)
  }

  /// Shares the holder's UTF-8 storage. Flush any pending surrogate before constructing the JSON value.
  public init(data holder: UTF8DataHolder) {
    self.data = holder.data
  }

  public init<T: Encodable>(encoding value: T) throws {
    // TODO: Optimize JSONEncoder via its options
    self.data = try JSONEncoder().encode(value)
  }

  public func decode<T: Decodable>() throws -> T {
    // TODO: Optimize JSONDecoder via its options
    return try JSONDecoder().decode(T.self, from: data)
  }

  /// Calls the consumer exactly once. The bytes are borrowed until its call returns.
  public func withUTF8(consumer: margelo.nitro.StringBufferConsumer) {
    data.withUnsafeBytes { bytes in
      consumer.call(bytes.baseAddress, bytes.count, .utf8)
    }
  }
}
