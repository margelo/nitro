//
//  Date+fromChrono.swift
//  Nitro
//
//  Created by Marc Rousavy on 04.06.25.
//

import Foundation

extension Date {
  /**
   * Create a new `Date` object from the given `std::chrono::system_clock::time_point` value.
   */
  public init(fromChrono date: margelo.nitro.chrono_time) {
    let millisecondsSinceEpoch = margelo.nitro.millisecondsSinceEpochFromChronoDate(date)
    self = .init(timeIntervalSince1970: millisecondsSinceEpoch / 1_000)
  }

  /**
   * Converts this `Date` object to a `std::chrono::system_clock::time_point` value.
   */
  public func toCpp() -> margelo.nitro.chrono_time {
    let secondsSinceEpoch = self.timeIntervalSince1970
    let millisecondsSinceEpoch = secondsSinceEpoch * 1_000
    return margelo.nitro.chronoDateFromMillisecondsSinceEpoch(millisecondsSinceEpoch)
  }
}
