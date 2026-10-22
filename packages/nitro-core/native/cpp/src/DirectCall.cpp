//
//  DirectCall.cpp
//  NitroModules
//

#include <NitroModules/DirectCall.hpp>

#include <cstdlib>
#include <cstring>

extern "C" void nitro_direct_set_string(void* target, const uint8_t* utf8, size_t length) {
  // Allocation failures cannot cross back into Swift, and there is nothing useful to recover.
  try {
    static_cast<std::string*>(target)->assign(reinterpret_cast<const char*>(utf8), length);
  } catch (...) {
    std::abort();
  }
}

extern "C" void nitro_direct_set_error(void* target, const char* message) {
  try {
    *static_cast<std::string*>(target) = message[0] != '\0' ? message : "unknown error";
  } catch (...) {
    std::abort();
  }
}

namespace margelo::nitro::direct {

void throwError(jsi::Runtime& runtime, const char* name, const std::string& message) {
  throw jsi::JSError(runtime, std::string(name) + ": " + message);
}

void StringData::append(bool ascii, const void* data, size_t count) {
  if (ascii && _isASCII) {
    _ascii.append(static_cast<const char*>(data), count);
    return;
  }
  if (_isASCII) {
    // Switch to UTF-16 and widen what was copied so far.
    _utf16.assign(_ascii.begin(), _ascii.end());
    _isASCII = false;
  }
  if (ascii) {
    const char* characters = static_cast<const char*>(data);
    _utf16.append(characters, characters + count);
  } else {
    _utf16.append(static_cast<const char16_t*>(data), count);
  }
}

void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result) {
  jsi::String string = value.getString(runtime);
  auto append = [&result](bool ascii, const void* data, size_t count) { result.append(ascii, data, count); };
  string.getStringData(runtime, append);
}

} // namespace margelo::nitro::direct
