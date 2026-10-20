//
//  JSIConverter+SwiftAnyJSON.hpp
//  NitroModulesSwiftBridge
//
//  Created by Marc Rousavy on 02.10.26.
//

#pragma once

#include <NitroModules/JSIConverter.hpp>

namespace NitroModules {
class AnyJSON;
}

namespace margelo::nitro {

using namespace facebook;

template <>
struct JSIConverter<NitroModules::AnyJSON> {
  static NitroModules::AnyJSON fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
  static jsi::Value toJSI(jsi::Runtime& runtime, const NitroModules::AnyJSON& value);
  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
};

} // namespace margelo::nitro
