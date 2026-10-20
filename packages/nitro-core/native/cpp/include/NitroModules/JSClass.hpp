#pragma once

#include <jsi/jsi.h>

namespace margelo::nitro {

/** A JavaScript class's constructor and instance prototype in one Runtime. */
struct JSClass final {
  facebook::jsi::Object prototype;
  facebook::jsi::Function constructor;
};

} // namespace margelo::nitro
