//
//  JSIString.hpp
//  NitroModules
//

#pragma once

#include <cstddef>
#include <cstdint>
#include <jsi/jsi.h>
#include <string_view>

namespace margelo::nitro {

template <size_t N>
struct StringLiteral {
  char data[N];

  constexpr StringLiteral(const char (&string)[N]) {
    for (size_t i = 0; i < N; ++i) {
      data[i] = string[i];
    }
  }
};

template <size_t N>
constexpr bool isAscii(const char (&string)[N]) {
  for (char character : string) {
    if (static_cast<unsigned char>(character) >= 128) {
      return false;
    }
  }
  return true;
}

/** Whether `string` can be passed to `jsi::String::createFromAscii(...)` and `jsi::PropNameID::forAscii(...)`. */
constexpr bool isAscii(std::string_view string) noexcept {
  for (char character : string) {
    if (static_cast<unsigned char>(character) >= 128) {
      return false;
    }
  }
  return true;
}

/** Creates a JSI string from a literal, choosing ASCII or UTF-8 at compile time. */
template <StringLiteral literal>
inline facebook::jsi::String createJSIString(facebook::jsi::Runtime& runtime) {
  constexpr size_t length = sizeof(literal.data) - 1;
  if constexpr (isAscii(literal.data)) {
    return facebook::jsi::String::createFromAscii(runtime, literal.data, length);
  } else {
    return facebook::jsi::String::createFromUtf8(runtime, reinterpret_cast<const uint8_t*>(literal.data), length);
  }
}

} // namespace margelo::nitro
