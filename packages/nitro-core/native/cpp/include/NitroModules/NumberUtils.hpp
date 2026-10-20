#pragma once

#include <limits>
#include <optional>
#include <stdexcept>
#include <string>

namespace margelo::nitro {

/** Returns an int if the number is an exact integer within the int range. */
static inline std::optional<int> tryDoubleToInt(double number) {
  if (!(number >= std::numeric_limits<int>::min() && number <= std::numeric_limits<int>::max())) {
    // Check the range before casting, including NaN and infinities.
    return std::nullopt;
  }
  int integer = static_cast<int>(number);
  if (number != integer) {
    return std::nullopt;
  }
  return integer;
}

/** Converts an exact integer to int, or throws if it cannot be represented. */
static inline int doubleToInt(double number) {
  auto integer = tryDoubleToInt(number);
  if (!integer.has_value()) [[unlikely]] {
    throw std::invalid_argument("Cannot convert " + std::to_string(number) + " to int - expected an integer within the int range!");
  }
  return *integer;
}

} // namespace margelo::nitro
