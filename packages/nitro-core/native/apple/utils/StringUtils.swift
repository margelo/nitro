//
//  StringUtils.swift
//  NitroModules
//

internal import Foundation
public import NitroModulesAppleCxx
internal import SimdUTF

@_expose(Cxx)
public final class StringUtils {
  private init() {}

  /// Decodes counted UTF-8, preserving embedded nulls and replacing invalid sequences with U+FFFD.
  /// The pointer must cover `count` bytes.
  public static func fromUTF8(bytes: UnsafePointer<UInt8>, count: Int) -> String {
    String(decoding: UnsafeBufferPointer(start: bytes, count: count), as: UTF8.self)
  }

  /// Appends counted ASCII, preserving embedded nulls.
  /// The pointer must cover `count` bytes and may be nil only when `count` is zero.
  public static func appendASCII(
    to result: inout String, bytes: UnsafePointer<UInt8>?, count: Int
  ) {
    result.append(uncheckedASCII: UnsafeBufferPointer(start: bytes, count: count))
  }

  /// Appends counted UTF-16, replacing unpaired surrogates with U+FFFD.
  /// The pointer must cover `count` units and may be nil only when `count` is zero.
  public static func appendUTF16(
    to result: inout String, units: UnsafePointer<UInt16>?, count: Int
  ) {
    result.append(decodingUTF16: UnsafeBufferPointer(start: units, count: count))
  }

  /// Calls the consumer exactly once with borrowed ASCII, UTF-8, or UTF-16.
  /// The consumer must finish using the buffer before its call returns.
  public static func withJSIStringData(
    value: String, consumer: margelo.nitro.StringBufferConsumer
  ) {
    if value.isEmpty {
      consumer.call(nil, 0, .ascii)
      return
    }
    if !value.isContiguousUTF8 {
      let foreign = value as CFString
      let count = CFStringGetLength(foreign)
      if let units = CFStringGetCharactersPtr(foreign) {
        withExtendedLifetime(foreign) {
          sendUTF16(units: units, count: count, to: consumer)
        }
      } else {
        // Opaque NSString subclasses require a copy. Repair this owned buffer in place.
        withUnsafeTemporaryAllocation(of: UInt16.self, capacity: count) { output in
          CFStringGetCharacters(foreign, CFRange(location: 0, length: count), output.baseAddress!)
          if consumer.canCreateUTF16Directly() {
            simdutf_swift_repair_utf16(output.baseAddress, count, output.baseAddress)
            consumer.call(output.baseAddress, count, .utf16)
          } else {
            sendUTF16(units: output.baseAddress!, count: count, to: consumer)
          }
        }
      }
      return
    }
    // For tiny native strings, borrowing UTF-8 directly costs less than preparing temporary UTF-16.
    if value.utf8.count <= 8 {
      var copy = value
      copy.withUTF8 { bytes in
        consumer.call(bytes.baseAddress, bytes.count, .utf8)
      }
      return
    }
    if #available(iOS 26.0, macOS 26.0, *) {
      let utf8 = value.utf8Span
      utf8.span.withUnsafeBufferPointer { bytes in
        if utf8.isKnownASCII {
          consumer.call(bytes.baseAddress, bytes.count, .ascii)
        } else if consumer.canCreateUTF16Directly() {
          // Transcode Swift's valid UTF-8 once; JSI copies the resulting UTF-16 directly.
          bytes.withUTF16 { units in
            consumer.call(units.baseAddress, units.count, .utf16)
          }
        } else {
          consumer.call(bytes.baseAddress, bytes.count, .utf8)
        }
      }
    } else {
      var copy = value
      copy.withUTF8 { bytes in
        // SIMD conversion also works on older OS versions. Classify larger buffers so ASCII stays direct.
        if bytes.count > 128 && consumer.canCreateUTF16Directly() {
          if value.isASCII {
            consumer.call(bytes.baseAddress, bytes.count, .ascii)
          } else {
            bytes.withUTF16 { units in
              consumer.call(units.baseAddress, units.count, .utf16)
            }
          }
        } else {
          consumer.call(bytes.baseAddress, bytes.count, .utf8)
        }
      }
    }
  }

  private static func sendUTF16(
    units: UnsafePointer<UInt16>, count: Int, to consumer: margelo.nitro.StringBufferConsumer
  ) {
    guard consumer.canCreateUTF16Directly() else {
      var native = String(decodingUTF16: UnsafeBufferPointer(start: units, count: count))
      native.withUTF8 { bytes in consumer.call(bytes.baseAddress, bytes.count, .utf8) }
      return
    }
    if simdutf_swift_validate_utf16(units, count) {
      consumer.call(units, count, .utf16)
      return
    }
    // Foundation owns the borrowed buffer, so repair into separate storage.
    withUnsafeTemporaryAllocation(of: UInt16.self, capacity: count) { output in
      simdutf_swift_repair_utf16(units, count, output.baseAddress)
      consumer.call(output.baseAddress, count, .utf16)
    }
  }
}
