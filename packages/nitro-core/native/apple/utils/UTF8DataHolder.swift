//
//  UTF8DataHolder.swift
//  NitroModules
//
//  Created by Marc Rousavy on 02.10.26.
//

public import Foundation
internal import SimdUTF

/// Accumulates borrowed ASCII and UTF-16 chunks as owned UTF-8 bytes.
@_expose(Cxx)
public struct UTF8DataHolder {
  private var storage = Data()
  private var pendingHighSurrogate: UInt16 = 0

  public init() {}

  /// The pointer must cover `count` bytes.
  public mutating func appendASCII(bytes: UnsafePointer<UInt8>, count: Int) {
    guard count > 0 else { return }
    flushPendingHighSurrogate()
    storage.append(bytes, count: count)
  }

  /// The pointer must cover `count` UTF-16 units.
  /// Surrogate pairs may span chunks. Unpaired surrogates are replaced with U+FFFD.
  public mutating func appendUTF16(units: UnsafePointer<UInt16>, count: Int) {
    guard count > 0 else { return }
    var offset = 0

    if pendingHighSurrogate != 0 {
      if (0xDC00...0xDFFF).contains(units[0]) {
        withUnsafeTemporaryAllocation(of: UInt16.self, capacity: 2) { pair in
          pair[0] = pendingHighSurrogate
          pair[1] = units[0]
          appendUTF16Chunk(units: pair.baseAddress!, count: 2)
        }
        pendingHighSurrogate = 0
        offset = 1
      } else {
        flushPendingHighSurrogate()
      }
    }

    var end = count
    if (0xD800...0xDBFF).contains(units[count - 1]) {
      pendingHighSurrogate = units[count - 1]
      end -= 1
    }
    if end > offset {
      appendUTF16Chunk(units: units.advanced(by: offset), count: end - offset)
    }
  }

  /// Accumulated UTF-8 bytes. Flush any pending surrogate after the final chunk before reading.
  public var data: Data {
    storage
  }

  /// Replaces a trailing unpaired high surrogate with U+FFFD. Repeated calls have no effect.
  public mutating func flushPendingHighSurrogate() {
    if pendingHighSurrogate != 0 {
      storage.append(contentsOf: [0xEF, 0xBF, 0xBD])
      pendingHighSurrogate = 0
    }
  }

  private mutating func appendUTF16Chunk(units: UnsafePointer<UInt16>, count: Int) {
    let offset = storage.count
    // Three UTF-8 bytes per UTF-16 unit also covers malformed input repaired to U+FFFD.
    storage.count = offset + count * 3
    let written = storage.withUnsafeMutableBytes { (bytes: UnsafeMutableRawBufferPointer) in
      simdutf_swift_utf16_to_utf8(
        units, count, bytes.baseAddress!.advanced(by: offset).assumingMemoryBound(to: UInt8.self)
      )
    }
    storage.count = offset + written
  }
}
