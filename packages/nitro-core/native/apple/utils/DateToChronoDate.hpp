//
//  DateToChronoDate.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 04.06.25.
//

#pragma once

#include "NitroTypeInfo.hpp"
#include <chrono>

namespace margelo::nitro {

using namespace std;

/**
 * Represents `std::chrono::system_clock::time_point`.
 */
using chrono_time = std::chrono::system_clock::time_point;

static inline chrono::system_clock::time_point chronoDateFromMillisecondsSinceEpoch(double msSinceEpoch) {
  auto durationMs = chrono::duration<double, std::milli>(msSinceEpoch);
  auto duration = chrono::duration_cast<chrono::system_clock::duration>(durationMs);
  auto date = chrono::system_clock::time_point(duration);
  return date;
}

static inline double millisecondsSinceEpochFromChronoDate(chrono::system_clock::time_point date) {
  auto duration = date.time_since_epoch();
  auto milliseconds = chrono::duration_cast<chrono::milliseconds>(duration).count();
  return static_cast<double>(milliseconds);
}

} // namespace margelo::nitro
