//
//  JSIConverter+SwiftString.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 29.09.26.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>

namespace swift {
class String;
}

namespace margelo::nitro {

using namespace facebook;

template <>
struct JSIConverter<swift::String> {
  static swift::String fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
  static jsi::String toJSI(jsi::Runtime& runtime, const swift::String& value);
  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
};

} // namespace margelo::nitro
