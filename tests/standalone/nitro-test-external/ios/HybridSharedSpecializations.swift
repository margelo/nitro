//
//  HybridSharedSpecializations.swift
//  NitroTestExternal
//

import NitroModules

class HybridSharedSpecializations: HybridSharedSpecializationsSpec {
  var numberCallback: any Callback<Double, Void> = .native { _ in }

  required override init() throws {
    try super.init()
  }

  func resolveVoid() throws -> any Promise<Void> {
    return .resolved()
  }

  func resolveNumber(value: Double) throws -> any Promise<Double> {
    return .async {
      return value
    }
  }

  func resolveString(value: String) throws -> any Promise<String> {
    return .resolved(with: value)
  }

  func awaitVoid(promise: any Promise<Void>) throws -> any Promise<Void> {
    return .async {
      try await promise.await()
    }
  }

  func awaitNumber(promise: any Promise<Double>) throws -> any Promise<Double> {
    return .async {
      return try await promise.await()
    }
  }

  func callVoid(callback: any Callback<(), Void>) throws {
    callback()
  }

  func callWithNumber(value: Double, callback: any Callback<Double, Void>) throws {
    callback(value)
  }

  func callWithString(value: String, callback: any Callback<String, Void>) throws {
    callback(value)
  }

  func mapNumber(value: Double, callback: any Callback<Double, Double>) throws -> any Promise<Double> {
    return .async {
      return try await callback(value)
    }
  }

  func wrapNumberCallback(callback: any Callback<Double, Void>) throws -> any Callback<Double, Void> {
    return .native { value in
      callback(value)
    }
  }

  func callVoidPromiseCallback(callback: any Callback<(), any Promise<Void>>) throws -> any Promise<Void> {
    return .async {
      let promise = try await callback()
      try await promise.await()
    }
  }

  func callNumberPromiseCallback(callback: any Callback<(), any Promise<Double>>) throws -> any Promise<Double> {
    return .async {
      let promise = try await callback()
      return try await promise.await()
    }
  }

  func callInline(callback: borrowing some InlineCallback<(), Void> & ~Copyable & ~Escapable) throws {
    try callback()
  }

  func callInlineWithNumber(
    value: Double,
    callback: borrowing some InlineCallback<Double, Double> & ~Copyable & ~Escapable
  ) throws -> Double {
    return try callback(value)
  }
}
