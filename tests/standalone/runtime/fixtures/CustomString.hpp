//
//  CustomString.hpp
//  NitroTest
//
//  Created by Marc Rousavy on 28.08.25.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <string>

namespace margelo::nitro::test {

// for demonstration, let's just do a struct that holds a string.
struct CustomString {
  std::string string;
};

}; // namespace margelo::nitro::test

namespace margelo::nitro {

template <>
struct JSIConverter<test::CustomString> final {
  static inline test::CustomString fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    return test::CustomString(arg.asString(runtime).utf8(runtime));
  }
  static inline jsi::Value toJSI(jsi::Runtime& runtime, const test::CustomString& arg) {
    return jsi::String::createFromUtf8(runtime, arg.string);
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value& value) {
    return value.isString();
  }
};

} // namespace margelo::nitro
