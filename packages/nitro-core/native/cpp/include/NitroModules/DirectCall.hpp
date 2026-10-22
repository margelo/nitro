//
//  DirectCall.hpp
//  NitroModules
//
//  Direct JSI host functions for static methods.
//
//  Nitrogen generates a `jsi::HostFunction` for each static method whose arguments and result are numbers,
//  booleans, strings, or structs of numbers and booleans. It reads the arguments straight from JSI's argument
//  array and calls the implementation with plain values: a `@_cdecl` Swift function on iOS. This skips the
//  generic `JSIConverter`s and the Swift/C++ interop wrappers. Any other input calls the method's regular JSI
//  implementation, so behavior and errors stay the same.
//

#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <jsi/jsi.h>
#include <memory>
#include <string>
#include <utility>

extern "C" {

/** Stores the UTF-8 string result of a generated Swift entry point in `target`, a `std::string*`. */
void nitro_direct_set_string(void* _Nonnull target, const uint8_t* _Nullable utf8, size_t length);

/** Stores the message of the error a generated Swift entry point reports in `target`, a `std::string*`. */
void nitro_direct_set_error(void* _Nonnull target, const char* _Nonnull message);

} // extern "C"

namespace margelo::nitro::direct {

using namespace facebook;

/** Creates the direct host function of a static method for `runtime`. `fallback` is its regular JSI implementation. */
using Factory = jsi::HostFunctionType (*)(jsi::Runtime& runtime, const jsi::HostFunctionType& fallback);

/** Throws the error a native implementation reported, the way the regular JSI implementation reports it. */
[[noreturn]] void throwError(jsi::Runtime& runtime, const char* name, const std::string& message);

/**
 * The characters of a JavaScript string, copied out of the Runtime: ASCII bytes, or UTF-16 code units if the
 * string has other characters.
 */
class StringData final {
public:
  const void* data() const {
    return _isASCII ? static_cast<const void*>(_ascii.data()) : static_cast<const void*>(_utf16.data());
  }
  size_t length() const {
    return _isASCII ? _ascii.size() : _utf16.size();
  }
  bool isASCII() const {
    return _isASCII;
  }

private:
  friend void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result);
  void append(bool ascii, const void* data, size_t count);

private:
  std::string _ascii;
  std::u16string _utf16;
  bool _isASCII = true;
};

/** Copies the characters of `value`, which must be a string. */
void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result);

/** Creates the property names a direct host function reads and writes on struct objects, once per Runtime. */
template <size_t N>
std::shared_ptr<const std::array<jsi::PropNameID, N>> createNames(jsi::Runtime& runtime, const char* const (&names)[N]) {
  return [&]<size_t... I>(std::index_sequence<I...>) {
    return std::make_shared<const std::array<jsi::PropNameID, N>>(
        std::array<jsi::PropNameID, N>{jsi::PropNameID::forAscii(runtime, names[I])...});
  }(std::make_index_sequence<N>{});
}

} // namespace margelo::nitro::direct
