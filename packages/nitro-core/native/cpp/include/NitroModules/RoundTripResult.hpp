#pragma once

#include <cstdint>

namespace besen {

struct RoundTripResult final {
  explicit RoundTripResult(int32_t value);

  int32_t value;
};

} // namespace besen
