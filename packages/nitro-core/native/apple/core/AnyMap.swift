//
//  AnyMap.swift
//  NitroModules
//
//  Created by Marc Rousavy on 20.08.24.
//

/// Represents any value representable by the `AnyMap`.
/// Note: Arrays are currently not implemented due to a Swift compiler bug https://github.com/swiftlang/swift/issues/75994
public indirect enum AnyValue {
  case null
  case number(Double)
  case bool(Bool)
  case int64(Int64)
  case string(String)
  case array([AnyValue])
  case object([String: AnyValue])

  static func create(_ value: margelo.nitro.AnyValue) -> AnyValue {
    if margelo.nitro.AnyMapUtils.is_AnyValue_null(value) {
      return .null
    } else if margelo.nitro.AnyMapUtils.is_AnyValue_bool(value) {
      return .bool(margelo.nitro.AnyMapUtils.get_AnyValue_bool(value))
    } else if margelo.nitro.AnyMapUtils.is_AnyValue_number(value) {
      return .number(margelo.nitro.AnyMapUtils.get_AnyValue_number(value))
    } else if margelo.nitro.AnyMapUtils.is_AnyValue_int64(value) {
      return .int64(margelo.nitro.AnyMapUtils.get_AnyValue_int64(value))
    } else if margelo.nitro.AnyMapUtils.is_AnyValue_string(value) {
      return .string(String(margelo.nitro.AnyMapUtils.get_AnyValue_string(value)))
    } else if margelo.nitro.AnyMapUtils.is_AnyValue_AnyArray(value) {
      return .array(margelo.nitro.AnyMapUtils.get_AnyValue_AnyArray(value).toSwift())
    } else if margelo.nitro.AnyMapUtils.is_AnyValue_AnyObject(value) {
      return .object(margelo.nitro.AnyMapUtils.get_AnyValue_AnyObject(value).toSwift())
    } else {
      fatalError("AnyValue has unknown type!")
    }
  }
}

/// Represents an `AnyMap`- an untyped map instance.
/// See C++ `AnyMap.hpp` for more information.
public final class AnyMap: @unchecked Sendable {
  public let cppPart: margelo.nitro.SharedAnyMap

  public init() {
    cppPart = margelo.nitro.AnyMap.make()
  }

  public init(withPreallocatedSize size: Int) {
    cppPart = margelo.nitro.AnyMap.make(size)
  }

  public init(withCppPart otherCppPart: margelo.nitro.SharedAnyMap) {
    cppPart = otherCppPart
  }

  // pragma MARK: Common Operations

  /**
   * Returns whether the given key exists in the map.
   */
  public func contains(key: String) -> Bool {
    return cppPart.pointee.contains(std.string(key))
  }

  /**
   * Removes the given key from the map.
   */
  public func remove(key: String) {
    cppPart.pointee.remove(std.string(key))
  }

  /**
   * Removes all keys in this map.
   */
  public func clear() {
    cppPart.pointee.clear()
  }

  /**
   * Get all keys in this map.
   */
  public func getAllKeys() -> [String] {
    let cppKeys = cppPart.pointee.getAllKeys()
    var keys = [String]()
    keys.reserveCapacity(cppKeys.count)
    for cppKey in cppKeys {
      keys.append(String(cppKey))
    }
    return keys
  }

  // pragma MARK: Getters

  /**
   * Gets the double value at the given key.
   * If no value exists at the given key, or if it is not a double,
   * this function throws.
   */
  public func getDouble(key: String) -> Double {
    return cppPart.pointee.getDouble(std.string(key))
  }

  /**
   * Gets the boolean value at the given key.
   * If no value exists at the given key, or if it is not a double,
   * this function throws.
   */
  public func getBoolean(key: String) -> Bool {
    return cppPart.pointee.getBoolean(std.string(key))
  }

  /**
   * Gets the Int64 value at the given key.
   * If no value exists at the given key, or if it is not an Int64,
   * this function throws.
   */
  public func getInt64(key: String) -> Int64 {
    return cppPart.pointee.getInt64(std.string(key))
  }

  /**
   * Gets the string value at the given key.
   * If no value exists at the given key, or if it is not a double,
   * this function throws.
   */
  public func getString(key: String) -> String {
    let value = cppPart.pointee.getString(std.string(key))
    return String(value)
  }

  /**
   * Gets the array value at the given key.
   * If no value exists at the given key, or if it is not a double,
   * this function throws.
   */
  public func getArray(key: String) -> [AnyValue] {
    let value = cppPart.pointee.getArray(std.string(key))
    return value.toSwift()
  }

  /**
   * Gets the object value at the given key.
   * If no value exists at the given key, or if it is not a double,
   * this function throws.
   */
  public func getObject(key: String) -> [String: AnyValue] {
    let value = cppPart.pointee.getObject(std.string(key))
    return value.toSwift()
  }

  /**
   * Gets the value value at the given key.
   * If no value exists at the given key,
   * this function throws.
   */
  public func getAny(key: String) -> Any? {
    let value = cppPart.pointee.getAny(std.string(key))
    let any = AnyValue.create(value)
    return any.toAny()
  }

  // pragma MARK: Setters

  /**
   * Set the given key to `null`.
   */
  public func setNull(key: String) {
    cppPart.pointee.setNull(std.string(key))
  }

  /**
   * Set the given key to the given double value.
   */
  public func setDouble(key: String, value: Double) {
    cppPart.pointee.setDouble(std.string(key), value)
  }

  /**
   * Set the given key to the given boolean value.
   */
  public func setBoolean(key: String, value: Bool) {
    cppPart.pointee.setBoolean(std.string(key), value)
  }

  /**
   * Set the given key to the given Int64 value.
   */
  public func setInt64(key: String, value: Int64) {
    cppPart.pointee.setInt64(std.string(key), value)
  }

  /**
   * Set the given key to the given string value.
   */
  public func setString(key: String, value: String) {
    cppPart.pointee.setString(std.string(key), std.string(value))
  }

  /**
   * Set the given key to the given array value.
   */
  public func setArray(key: String, value: [AnyValue]) {
    cppPart.pointee.setArray(std.string(key), margelo.nitro.AnyArray.create(value))
  }

  /**
   * Set the given key to the given object value.
   */
  public func setObject(key: String, value: [String: AnyValue]) {
    cppPart.pointee.setObject(std.string(key), margelo.nitro.AnyObject.create(value))
  }

  /**
   * Set the given key to the given any value.
   */
  public func setAny(key: String, value: Any?) throws {
    let swiftAny = try AnyValue.fromAny(value)
    let cppAny = margelo.nitro.AnyValue.create(swiftAny)
    cppPart.pointee.setAny(std.string(key), cppAny)
  }

  // pragma MARK: Is Getters

  /**
   * Gets whether the given `key` is holding a null value, or not.
   */
  public func isNull(key: String) -> Bool {
    return cppPart.pointee.isNull(std.string(key))
  }

  /**
   * Gets whether the given `key` is holding a double value, or not.
   */
  public func isDouble(key: String) -> Bool {
    return cppPart.pointee.isDouble(std.string(key))
  }

  /**
   * Gets whether the given `key` is holding a boolean value, or not.
   */
  public func isBool(key: String) -> Bool {
    return cppPart.pointee.isBoolean(std.string(key))
  }

  /**
   * Gets whether the given `key` is holding a Int64 value, or not.
   */
  public func isInt64(key: String) -> Bool {
    return cppPart.pointee.isInt64(std.string(key))
  }

  /**
   * Gets whether the given `key` is holding a string value, or not.
   */
  public func isString(key: String) -> Bool {
    return cppPart.pointee.isString(std.string(key))
  }

  /**
   * Gets whether the given `key` is holding an array value, or not.
   */
  public func isArray(key: String) -> Bool {
    return cppPart.pointee.isArray(std.string(key))
  }

  /**
   * Gets whether the given `key` is holding an object value, or not.
   */
  public func isObject(key: String) -> Bool {
    return cppPart.pointee.isObject(std.string(key))
  }

  /**
   * Merges all keys and values from the `other` map into this map.
   */
  public func merge(other: AnyMap) {
    cppPart.pointee.merge(other.cppPart)
  }
}

// pragma MARK: margelo.nitro.AnyValue extension

extension margelo.nitro.AnyValue {
  static func create(_ value: AnyValue) -> margelo.nitro.AnyValue {
    switch value {
    case .null:
      return create(NullType.null)
    case .bool(let bool):
      return create(bool)
    case .number(let number):
      return create(number)
    case .int64(let int64):
      return create(int64)
    case .string(let string):
      return create(string)
    case .array(let array):
      return create(array)
    case .object(let object):
      return create(object)
    }
  }
  static func create(_ null: NullType) -> margelo.nitro.AnyValue {
    return margelo.nitro.AnyMapUtils.create_AnyValue(margelo.nitro.NullType.null)
  }
  static func create(_ value: Bool) -> margelo.nitro.AnyValue {
    return margelo.nitro.AnyMapUtils.create_AnyValue(value)
  }
  static func create(_ value: Double) -> margelo.nitro.AnyValue {
    return margelo.nitro.AnyMapUtils.create_AnyValue(value)
  }
  static func create(_ value: Int64) -> margelo.nitro.AnyValue {
    return margelo.nitro.AnyMapUtils.create_AnyValue(value)
  }
  static func create(_ value: String) -> margelo.nitro.AnyValue {
    return margelo.nitro.AnyMapUtils.create_AnyValue(std.string(value))
  }
  static func create(_ value: [AnyValue]) -> margelo.nitro.AnyValue {
    return margelo.nitro.AnyMapUtils.create_AnyValue(margelo.nitro.AnyArray.create(value))
  }
  static func create(_ value: [String: AnyValue]) -> margelo.nitro.AnyValue {
    return margelo.nitro.AnyMapUtils.create_AnyValue(margelo.nitro.AnyObject.create(value))
  }
}

// pragma MARK: margelo.nitro.AnyArray extension

extension margelo.nitro.AnyArray {
  static func create(_ array: [AnyValue]) -> margelo.nitro.AnyArray {
    var vector = margelo.nitro.AnyArray()
    vector.reserve(array.count)
    for value in array {
      vector.push_back(margelo.nitro.AnyValue.create(value))
    }
    return vector
  }

  func toSwift() -> [AnyValue] {
    var array: [AnyValue] = []
    array.reserveCapacity(self.size())
    for value in self {
      array.append(AnyValue.create(value))
    }
    return array
  }
}

// pragma MARK: margelo.nitro.AnyObject extension

extension margelo.nitro.AnyObject {
  static func create(_ dictionary: [String: AnyValue]) -> margelo.nitro.AnyObject {
    var object = margelo.nitro.AnyObject()
    object.reserve(dictionary.count)
    for (key, value) in dictionary {
      object[std.string(key)] = margelo.nitro.AnyValue.create(value)
    }
    return object
  }

  func toSwift() -> [String: AnyValue] {
    let keys = margelo.nitro.AnyMapUtils.getAnyObjectKeys(self)
    var dictionary = [String: AnyValue](minimumCapacity: keys.size())
    for key in keys {
      let value = margelo.nitro.AnyMapUtils.getAnyObjectValue(self, key)
      dictionary[String(key)] = AnyValue.create(value)
    }
    return dictionary
  }
}

// pragma MARK: AnyValue <-> Any extension

extension AnyValue {
  public static func fromAny(_ any: Any?) throws -> AnyValue {
    switch any {
    case nil:
      return AnyValue.null
    case let value as String:
      return AnyValue.string(value)
    case let value as Double:
      return AnyValue.number(value)
    case let value as Int:
      return AnyValue.number(Double(value))
    case let value as Float:
      return AnyValue.number(Double(value))
    case let value as Int64:
      return AnyValue.int64(value)
    case let value as Bool:
      return AnyValue.bool(value)
    case let value as [Any]:
      let array = try value.map { try AnyValue.fromAny($0) }
      return AnyValue.array(array)
    case let value as [String: Any]:
      let map = try value.mapValues { try AnyValue.fromAny($0) }
      return AnyValue.object(map)
    case is AnyValue, is AnyMap, is margelo.nitro.AnyValue, is margelo.nitro.AnyArray,
      is margelo.nitro.AnyObject:
      throw RuntimeError.error(
        withMessage: "Cannot box AnyValue (\(String(describing: any))) twice!")
    default:
      throw RuntimeError.error(
        withMessage: "Value \(String(describing: any)) cannot be represented as AnyValue!")
    }
  }

  public func toAny() -> Any? {
    switch self {
    case .null:
      return nil
    case .int64(let int):
      return int
    case .bool(let bool):
      return bool
    case .number(let double):
      return double
    case .array(let array):
      return array.map { $0.toAny() }
    case .object(let object):
      return object.mapValues { $0.toAny() }
    case .string(let string):
      return string
    }
  }
}

// pragma MARK: AnyMap <-> Any extension

extension AnyMap {
  /**
  * Convert the given `Dictionary<String, Any?>` to an `AnyMap`
  * by copying all keys and values into the C++ container.
  * If a key cannot be wrapped as any, this will throw.
  */
  public static func fromDictionary(_ dictionary: [String: Any?]) throws -> AnyMap {
    let map = AnyMap(withPreallocatedSize: dictionary.count)
    for (key, value) in dictionary {
      try map.setAny(key: key, value: value)
    }
    return map
  }
  /**
  * Convert the given `Dictionary<String, Any?>` to an `AnyMap`
  * by copying all keys and values into the C++ container.
  * If a key cannot be wrapped as any, it will simply be ignored and omitted.
  */
  public static func fromDictionaryIgnoreIncompatible(_ dictionary: [String: Any?]) -> AnyMap {
    let map = AnyMap(withPreallocatedSize: dictionary.count)
    for (key, value) in dictionary {
      try? map.setAny(key: key, value: value)
    }
    return map
  }

  /**
  * Convert this `AnyMap` instance to a `Dictionary<String, Any?>`
  * by copying all keys and values into a wrapped Swift container.
  */
  public func toDictionary() -> [String: Any?] {
    var dictionary: [String: Any?] = [:]
    let keys = self.getAllKeys()
    dictionary.reserveCapacity(keys.count)
    for key in keys {
      dictionary[key] = self.getAny(key: key)
    }
    return dictionary
  }
}
